// @vitest-environment node
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'

interface SessionFixture {
  readonly token: string
  readonly record: {
    readonly id: string
    readonly displayName: string
    readonly avatarKey: string
    readonly onboardingCompleted: boolean
  }
}

const sessionsByToken: Readonly<Record<string, SessionFixture | 'unavailable'>> = {
  'fixture-incomplete-user-token': {
    token: 'rotated-incomplete-user-token',
    record: {
      id: 'incomplete-user',
      displayName: 'Incomplete User',
      avatarKey: 'avatar-incomplete',
      onboardingCompleted: false,
    },
  },
  'fixture-completed-user-token': {
    token: 'rotated-completed-user-token',
    record: {
      id: 'completed-user',
      displayName: 'Completed User',
      avatarKey: 'avatar-complete',
      onboardingCompleted: true,
    },
  },
  'fixture-unavailable-token': 'unavailable',
}

const startSessionProvider = async () => {
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/api/collections/users/auth-refresh') {
      response.writeHead(404).end()
      return
    }

    const authorization = request.headers.authorization
    const token = typeof authorization === 'string' ? authorization.replace(/^Bearer\s+/, '') : ''
    const fixture = sessionsByToken[token]

    if (fixture === 'unavailable') {
      response.writeHead(503, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ code: 503, message: 'PocketBase is unavailable', data: {} }))
      return
    }

    if (!fixture) {
      response.writeHead(401, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ code: 401, message: 'Invalid session', data: {} }))
      return
    }

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(fixture))
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Test session provider did not bind to a TCP port.')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    stop: async () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    }),
  }
}

const sessionProvider = await startSessionProvider()

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  env: {
    NUXT_POCKETBASE_URL: sessionProvider.baseUrl,
    NUXT_APP_ORIGIN: 'http://localhost:3000',
    NUXT_SESSION_COOKIE_MODE: 'development-http',
  },
})

afterAll(async () => {
  await sessionProvider.stop()
})

const sessionCookie = (token: string): string => `kunai_session=${token}`

const requestRoute = (path: string, cookie?: string) => fetch(path, {
  headers: cookie ? { cookie } : undefined,
  redirect: 'manual',
})

describe('Phase 0002 auth routing SSR integration', () => {
  it('redirects anonymous visitors to login and renders login without protected content', async () => {
    const redirect = await requestRoute('/')

    expect(redirect.status).toBe(302)
    expect(redirect.headers.get('location')).toBe('/login')
    expect(redirect.headers.get('cache-control')).toBeNull()
    expect(redirect.headers.get('set-cookie')).toBeNull()

    const login = await requestRoute('/login')
    const html = await login.text()

    expect(login.status).toBe(200)
    expect(html).toContain('Login')
    expect(html).not.toContain('Home')
    expect(html).not.toContain('Onboarding')
  })

  it('redirects incomplete sessions to onboarding and rotates their cookie', async () => {
    const response = await requestRoute('/', sessionCookie('fixture-incomplete-user-token'))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/onboarding')
    expect(response.headers.get('cache-control')).toContain('private, no-store')
    expect(response.headers.get('set-cookie')).toContain('kunai_session=rotated-incomplete-user-token')
  })

  it('renders Home for complete sessions with a private rotated response', async () => {
    const response = await requestRoute('/', sessionCookie('fixture-completed-user-token'))
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('private, no-store')
    expect(response.headers.get('set-cookie')).toContain('kunai_session=rotated-completed-user-token')
    expect(html).toContain('Home')
    expect(html).toContain('Completed User')
    expect(html).not.toContain('Onboarding')
  })

  it('clears invalid sessions before redirecting them to login', async () => {
    const response = await requestRoute('/', sessionCookie('fixture-expired-token'))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(response.headers.get('set-cookie')).toMatch(/kunai_session=;|Max-Age=0/i)
  })

  it('renders only the central unavailable output with status 503 and retains its retryable cookie', async () => {
    const response = await requestRoute('/', sessionCookie('fixture-unavailable-token'))
    const html = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toContain('private, no-store')
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(html).toContain('Session could not be validated')
    expect(html).not.toContain('Home')
    expect(html).not.toContain('Completed User')
    expect(html).not.toContain('Onboarding')
  })
})
