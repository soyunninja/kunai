import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { createApp, toNodeListener } from 'h3'
import type PocketBase from 'pocketbase'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import loginHandler from '../../server/api/auth/login.post'
import logoutHandler from '../../server/api/auth/logout.post'
import sessionHandler from '../../server/api/auth/session.get'
import completeOnboardingHandler from '../../server/api/onboarding/complete.post'
import homeHandler from '../../server/api/home.get'
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

const validOnboarding = {
  displayName: 'Security Test User',
  avatarKey: 'avatar-01',
  timezone: 'Europe/Madrid',
  defaultLocation: null,
} as const

const requestHeaders = (origin = runtimeConfig.value.appOrigin, extra: Record<string, string> = {}) => ({
  'content-type': 'application/json',
  origin,
  'sec-fetch-site': origin === runtimeConfig.value.appOrigin ? 'same-origin' : 'cross-site',
  ...extra,
})

const setCookies = (response: Response): string[] => {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  return headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter((value): value is string => Boolean(value))
}

const cookieHeader = (response: Response, name = 'kunai_session'): string => {
  const cookie = setCookies(response).find((value) => value.startsWith(`${name}=`))
  expect(cookie).toBeDefined()
  return cookie?.split(';')[0] ?? ''
}

const serializedResponse = async (response: Response): Promise<string> => await response.text()

const uniqueEmail = (label: string) => `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`

describe('Phase 0002 H3 security boundaries with disposable PocketBase', () => {
  let harness: PocketBaseHarness
  let admin: PocketBase
  let server: Server
  let baseUrl: string

  const provisionUser = async (label: string) => {
    const email = uniqueEmail(label)
    const userId = await createNormalUser(admin, email)
    await admin.collection('users').update(userId, {
      displayName: '',
      avatarKey: '',
      timezone: '',
      onboardingCompleted: false,
    })
    return { email, userId }
  }

  const login = async (email: string): Promise<Response> => await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({ email, password: USER_PASSWORD }),
  })

  const complete = async (cookie: string, payload: Record<string, unknown> = validOnboarding): Promise<Response> => await fetch(`${baseUrl}/api/onboarding/complete`, {
    method: 'POST',
    headers: { ...requestHeaders(), cookie },
    body: JSON.stringify(payload),
  })

  beforeAll(async () => {
    harness = await createPocketBaseHarness()
    runtimeConfig.value.pocketbaseUrl = harness.baseUrl
    applyMigrations(harness)
    upsertSuperuser(harness)
    await startPocketBase(harness)
    admin = await superuserClient(harness.baseUrl)

    const app = createApp()
    app.use('/api/auth/login', loginHandler)
    app.use('/api/auth/session', sessionHandler)
    app.use('/api/auth/logout', logoutHandler)
    app.use('/api/onboarding/complete', completeOnboardingHandler)
    app.use('/api/home', homeHandler)
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

  beforeEach(() => {
    runtimeConfig.value = {
      pocketbaseUrl: harness.baseUrl,
      appOrigin: 'http://localhost:3000',
      sessionCookieMode: 'development-http',
    }
  })

  it.each([
    ['missing Origin', {}],
    ['null Origin', { origin: 'null', 'sec-fetch-site': 'same-origin' }],
    ['malformed Origin', { origin: 'not a url', 'sec-fetch-site': 'same-origin' }],
    ['cross-origin metadata', { origin: 'http://localhost:3000', 'sec-fetch-site': 'cross-site' }],
    ['cross origin', { origin: 'https://attacker.example.test', 'sec-fetch-site': 'cross-site' }],
  ])('rejects %s before unsafe login, logout, and onboarding mutations', async (_scenario, unsafeHeaders) => {
    const user = await provisionUser('csrf')
    const authenticated = await login(user.email)
    const cookie = cookieHeader(authenticated)

    const loginAttempt = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...unsafeHeaders },
      body: JSON.stringify({ email: user.email, password: USER_PASSWORD }),
    })
    expect(loginAttempt.status).toBe(403)
    expect(setCookies(loginAttempt)).toHaveLength(0)

    const logoutAttempt = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, ...unsafeHeaders },
      body: JSON.stringify({}),
    })
    expect(logoutAttempt.status).toBe(403)
    expect(setCookies(logoutAttempt)).toHaveLength(0)

    const onboardingAttempt = await fetch(`${baseUrl}/api/onboarding/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, ...unsafeHeaders },
      body: JSON.stringify(validOnboarding),
    })
    const onboardingBody = await onboardingAttempt.json() as { error?: { code?: string } }
    const persisted = await admin.collection('users').getOne<{ onboardingCompleted: boolean }>(user.userId)

    expect(onboardingAttempt.status).toBe(403)
    expect(onboardingBody.error?.code).toBe('forbidden_origin')
    expect(onboardingAttempt.headers.get('cache-control')).toBe('private, no-store')
    expect(setCookies(onboardingAttempt)).toHaveLength(0)
    expect(persisted.onboardingCompleted).toBe(false)
  })

  it('uses explicit development and production cookie security shapes without exposing the bearer in JSON', async () => {
    const developmentUser = await provisionUser('cookie-development')
    const developmentLogin = await login(developmentUser.email)
    const developmentBody = await serializedResponse(developmentLogin)
    const developmentCookie = cookieHeader(developmentLogin)

    expect(developmentLogin.status).toBe(200)
    expect(setCookies(developmentLogin).join('\n')).toContain('kunai_session=')
    expect(setCookies(developmentLogin).join('\n')).toContain('Path=/')
    expect(setCookies(developmentLogin).join('\n')).toContain('HttpOnly')
    expect(setCookies(developmentLogin).join('\n')).toContain('SameSite=Lax')
    expect(setCookies(developmentLogin).join('\n')).not.toMatch(/; Secure/i)
    expect(developmentBody).not.toContain(developmentCookie.replace('kunai_session=', ''))
    expect(developmentBody).not.toContain(USER_PASSWORD)

    runtimeConfig.value = {
      pocketbaseUrl: harness.baseUrl,
      appOrigin: 'https://kunai.example.test',
      sessionCookieMode: 'secure',
    }
    const productionUser = await provisionUser('cookie-production')
    const productionLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: requestHeaders('https://kunai.example.test'),
      body: JSON.stringify({ email: productionUser.email, password: USER_PASSWORD }),
    })
    const productionBody = await serializedResponse(productionLogin)
    const productionCookie = cookieHeader(productionLogin, '__Host-kunai_session')
    const productionSetCookie = setCookies(productionLogin).join('\n')

    expect(productionLogin.status).toBe(200)
    expect(productionSetCookie).toContain('__Host-kunai_session=')
    expect(productionSetCookie).toContain('Path=/')
    expect(productionSetCookie).toContain('HttpOnly')
    expect(productionSetCookie).toContain('Secure')
    expect(productionSetCookie).toContain('SameSite=Lax')
    expect(productionSetCookie).not.toMatch(/; Domain=/i)
    expect(productionBody).not.toContain(productionCookie.replace('__Host-kunai_session=', ''))
    expect(productionBody).not.toContain(USER_PASSWORD)
  })

  it('keeps session identity isolated across overlapping cookie-authenticated requests and projects no token sentinel', async () => {
    const userA = await provisionUser('identity-a')
    const userB = await provisionUser('identity-b')
    const [loginA, loginB] = await Promise.all([login(userA.email), login(userB.email)])
    const cookieA = cookieHeader(loginA)
    const cookieB = cookieHeader(loginB)

    const [responseA, responseB] = await Promise.all([
      fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: cookieA } }),
      fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: cookieB } }),
    ])
    const [bodyA, bodyB] = await Promise.all([responseA.json(), responseB.json()]) as [Record<string, unknown>, Record<string, unknown>]
    const serializedA = JSON.stringify(bodyA)
    const serializedB = JSON.stringify(bodyB)

    expect(responseA.status).toBe(200)
    expect(responseB.status).toBe(200)
    expect(bodyA).toMatchObject({ session: { id: userA.userId } })
    expect(bodyB).toMatchObject({ session: { id: userB.userId } })
    expect(serializedA).not.toContain(userB.userId)
    expect(serializedB).not.toContain(userA.userId)
    expect(serializedA).not.toContain(cookieA.replace('kunai_session=', ''))
    expect(serializedB).not.toContain(cookieB.replace('kunai_session=', ''))
  })

  it('rejects onboarding mass assignment through its H3 payload before persistence', async () => {
    const user = await provisionUser('onboarding-mass-assignment')
    const authenticated = await login(user.email)
    const cookie = cookieHeader(authenticated)
    const response = await complete(cookie, {
      ...validOnboarding,
      owner: 'forged-owner',
      onboardingCompleted: true,
      onboardingCompletedAt: '2000-01-01 00:00:00.000Z',
      email: 'attacker@example.test',
      password: 'attacker-password-sentinel',
    })
    const body = await response.json() as { error?: { code?: string } }
    const persisted = await admin.collection('users').getOne<Record<string, unknown>>(user.userId)

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body.error?.code).toBe('invalid_onboarding_input')
    expect(persisted.onboardingCompleted).toBe(false)
    expect(persisted.email).toBe(user.email)
    expect(persisted.displayName).toBe('')
    expect(JSON.stringify(body)).not.toContain('attacker-password-sentinel')
  })

  it('distinguishes invalid sessions from upstream outage on private Home responses', async () => {
    const user = await provisionUser('home-session-failures')
    const authenticated = await login(user.email)
    const completed = await complete(cookieHeader(authenticated))
    const activeCookie = cookieHeader(completed)

    const invalid = await fetch(`${baseUrl}/api/home`, { headers: { cookie: 'kunai_session=invalid.session.token' } })
    const invalidBody = await invalid.json() as { error?: { code?: string } }
    expect(invalid.status).toBe(401)
    expect(invalid.headers.get('cache-control')).toBe('private, no-store')
    expect(invalidBody.error?.code).toBe('unauthenticated')
    expect(setCookies(invalid).join('\n')).toMatch(/kunai_session=;|Max-Age=0/i)

    runtimeConfig.value.pocketbaseUrl = 'http://127.0.0.1:1'
    const outage = await fetch(`${baseUrl}/api/home`, { headers: { cookie: activeCookie } })
    const outageBody = await outage.json() as { error?: { code?: string } }

    expect(outage.status).toBe(503)
    expect(outage.headers.get('cache-control')).toBe('private, no-store')
    expect(outageBody.error?.code).toBe('session_unavailable')
    expect(setCookies(outage)).toHaveLength(0)
    expect(JSON.stringify(outageBody)).not.toContain(activeCookie.replace('kunai_session=', ''))
  })

  it.fails('marks session success and invalid/outage errors private and no-store until 14.2 fixes the evidenced defect', async () => {
    const user = await provisionUser('session-cache-control')
    const authenticated = await login(user.email)
    const valid = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: cookieHeader(authenticated) } })
    const invalid = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: 'kunai_session=invalid.session.token' } })

    runtimeConfig.value.pocketbaseUrl = 'http://127.0.0.1:1'
    const outage = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: cookieHeader(authenticated) } })

    expect(valid.headers.get('cache-control')).toBe('private, no-store')
    expect(invalid.headers.get('cache-control')).toBe('private, no-store')
    expect(outage.status).toBe(503)
    expect(outage.headers.get('cache-control')).toBe('private, no-store')
  })
})
