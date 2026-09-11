import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { createApp, toNodeListener } from 'h3'
import type PocketBase from 'pocketbase'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import loginHandler from '../../server/api/auth/login.post'
import logoutHandler from '../../server/api/auth/logout.post'
import sessionHandler from '../../server/api/auth/session.get'
import {
  applyMigrations,
  createNormalUser,
  createPocketBaseHarness,
  startPocketBase,
  stopPocketBase,
  superuserClient,
  upsertSuperuser,
  USER_PASSWORD,
  type PocketBaseHarness,
} from '../integration/pocketbase/support/harness'

const runtimeConfig = vi.hoisted(() => ({
  value: {
    pocketbaseUrl: '',
    appOrigin: 'http://localhost:3000',
    sessionCookieMode: 'development-http',
  },
}))

vi.mock('../../server/utils/runtime-config', () => ({
  getRuntimeConfig: () => runtimeConfig.value,
}))

const jsonHeaders = (origin = runtimeConfig.value.appOrigin) => ({
  'content-type': 'application/json',
  origin,
  'sec-fetch-site': origin === runtimeConfig.value.appOrigin ? 'same-origin' : 'cross-site',
})

const setCookies = (response: Response): string[] => {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  return headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter((value): value is string => Boolean(value))
}

const sessionCookieHeader = (response: Response): string => {
  const cookie = setCookies(response).find((value) => value.startsWith('kunai_session='))
  expect(cookie).toBeDefined()
  return cookie?.split(';')[0] ?? ''
}

describe('auth routes H3 boundary', () => {
  let harness: PocketBaseHarness
  let admin: PocketBase
  let server: Server
  let baseUrl: string
  let email: string

  beforeAll(async () => {
    harness = await createPocketBaseHarness()
    runtimeConfig.value.pocketbaseUrl = harness.baseUrl
    applyMigrations(harness)
    upsertSuperuser(harness)
    await startPocketBase(harness)
    admin = await superuserClient(harness.baseUrl)
    email = 'h3-auth-boundary@example.test'
    const userId = await createNormalUser(admin, email)
    await admin.collection('users').update(userId, {
      displayName: 'H3 Boundary User',
      avatarKey: 'fixture-h3',
      timezone: 'Europe/Madrid',
      onboardingCompleted: false,
    })

    const app = createApp()
    app.use('/api/auth/login', loginHandler)
    app.use('/api/auth/session', sessionHandler)
    app.use('/api/auth/logout', logoutHandler)
    server = createServer(toNodeListener(app))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  }, 180_000)

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    await stopPocketBase(harness)
  })

  it('parses login requests, sets an HttpOnly cookie, and returns only the safe session body', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email, password: USER_PASSWORD }),
    })
    const body = await response.json() as { session?: Record<string, unknown> }
    const cookie = setCookies(response).join('\n')

    expect(response.status).toBe(200)
    expect(body.session).toMatchObject({
      displayName: 'H3 Boundary User',
      avatarKey: 'fixture-h3',
      onboardingCompleted: false,
    })
    expect(body.session).not.toHaveProperty('token')
    expect(cookie).toContain('kunai_session=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(JSON.stringify(body)).not.toContain(sessionCookieHeader(response).replace('kunai_session=', ''))
  })

  it('rejects malformed login boundary input before authentication', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email }),
    })
    const body = await response.json() as { error?: { code?: string } }

    expect(response.status).toBe(400)
    expect(body.error?.code).toBe('invalid_request')
    expect(setCookies(response)).toHaveLength(0)
  })

  it('rejects cross-origin login attempts at the H3 boundary', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: jsonHeaders('http://evil.example.test'),
      body: JSON.stringify({ email, password: USER_PASSWORD }),
    })
    const body = await response.json() as { error?: { code?: string } }

    expect(response.status).toBe(403)
    expect(body.error?.code).toBe('forbidden_origin')
    expect(setCookies(response)).toHaveLength(0)
  })

  it('returns 401 for invalid credentials and 503 for transient login outage', async () => {
    const invalid = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email, password: 'wrong-password' }),
    })
    const invalidBody = await invalid.json() as { error?: { code?: string, message?: string } }

    expect(invalid.status).toBe(401)
    expect(invalidBody.error).toMatchObject({
      code: 'invalid_credentials',
      message: 'Invalid email or password.',
    })

    const availablePocketBaseUrl = runtimeConfig.value.pocketbaseUrl
    runtimeConfig.value.pocketbaseUrl = 'http://127.0.0.1:1'
    try {
      const outage = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ email, password: USER_PASSWORD }),
      })
      const outageBody = await outage.json() as { error?: { code?: string, message?: string } }

      expect(outage.status).toBe(503)
      expect(outageBody.error?.code).toBe('session_unavailable')
      expect(outageBody.error?.message).not.toContain(USER_PASSWORD)
      expect(outageBody.error?.message).not.toContain(email)
    } finally {
      runtimeConfig.value.pocketbaseUrl = availablePocketBaseUrl
    }
  })

  it('restores a cookie-backed session through the H3 boundary without exposing the token', async () => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email, password: USER_PASSWORD }),
    })
    const cookie = sessionCookieHeader(login)
    const token = cookie.replace('kunai_session=', '')

    const response = await fetch(`${baseUrl}/api/auth/session`, {
      method: 'GET',
      headers: { cookie },
    })
    const body = await response.json() as { session?: Record<string, unknown> }

    expect(response.status).toBe(200)
    expect(body.session).toMatchObject({ displayName: 'H3 Boundary User' })
    expect(body.session).not.toHaveProperty('token')
    expect(JSON.stringify(body)).not.toContain(token)
    expect(setCookies(response).join('\n')).toContain('kunai_session=')
  })

  it('clears the session cookie through logout and enforces same-origin logout', async () => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email, password: USER_PASSWORD }),
    })
    const cookie = sessionCookieHeader(login)

    const forbidden = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { ...jsonHeaders('http://evil.example.test'), cookie },
    })
    const forbiddenBody = await forbidden.json() as { error?: { code?: string } }

    expect(forbidden.status).toBe(403)
    expect(forbiddenBody.error?.code).toBe('forbidden_origin')

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { ...jsonHeaders(), cookie },
    })
    const clearCookie = setCookies(logout).join('\n')

    expect(logout.status).toBe(204)
    expect(clearCookie).toContain('kunai_session=')
    expect(clearCookie).toContain('Max-Age=0')
    expect(clearCookie).toContain('HttpOnly')
  })
})
