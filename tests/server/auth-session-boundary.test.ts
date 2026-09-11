import { readFile } from 'node:fs/promises'

import type PocketBase from 'pocketbase'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { secretFreeString } from './secret-free-string'
import { createRequestPocketBase, getRequestPocketBase, type RequestEventLike } from '../../server/utils/pocketbase-client'
import { validateSameOrigin } from '../../server/utils/same-origin'
import { getSessionConfig } from '../../server/utils/session-config'
import {
  clearSessionCookie,
  loginWithPassword,
  logoutSession,
  resolveSession,
  sessionCookieOptions,
  setSessionCookie,
  type CookieController,
} from '../../server/utils/session'
import {
  applyMigrations,
  createNormalUser,
  createPocketBaseHarness,
  normalClient,
  startPocketBase,
  stopPocketBase,
  superuserClient,
  upsertSuperuser,
  USER_PASSWORD,
  type PocketBaseHarness,
} from '../integration/pocketbase/support/harness'

interface StoredCookie {
  value: string
  options: unknown
  deleted?: boolean
}

const runtime = (baseUrl: string) => ({
  pocketbaseUrl: baseUrl,
  appOrigin: 'http://localhost:3000',
  sessionCookieMode: 'development-http',
})

const createEvent = (): RequestEventLike => ({ context: {} })

const createCookieJar = (initial: Record<string, string> = {}) => {
  const jar = new Map<string, StoredCookie>()
  for (const [name, value] of Object.entries(initial)) {
    jar.set(name, { value, options: {} })
  }

  const controller: CookieController = {
    getCookie: (name) => jar.get(name)?.value,
    setCookie: (name, value, options) => {
      jar.set(name, { value, options })
    },
    deleteCookie: (name, options) => {
      jar.set(name, { value: '', options, deleted: true })
    },
  }

  return { jar, controller }
}

const headerReader = (headers: Record<string, string | undefined>) => ({
  getHeader: (name: string) => headers[name.toLowerCase()],
})

describe('Checkpoint 3 auth/session boundary', () => {
  let harness: PocketBaseHarness
  let admin: PocketBase
  let userAEmail: string
  let userBEmail: string

  beforeAll(async () => {
    harness = await createPocketBaseHarness()
    applyMigrations(harness)
    upsertSuperuser(harness)
    await startPocketBase(harness)
    admin = await superuserClient(harness.baseUrl)

    userAEmail = 'session-a@example.test'
    userBEmail = 'session-b@example.test'
    const userAId = await createNormalUser(admin, userAEmail)
    const userBId = await createNormalUser(admin, userBEmail)
    await admin.collection('users').update(userAId, {
      displayName: 'User A',
      avatarKey: 'fixture-a',
      timezone: 'Europe/Madrid',
      onboardingCompleted: false,
    })
    await admin.collection('users').update(userBId, {
      displayName: 'User B',
      avatarKey: 'fixture-b',
      timezone: 'Asia/Tokyo',
      onboardingCompleted: true,
    })
  }, 180_000)

  afterAll(async () => {
    await stopPocketBase(harness)
  })

  it('creates a request-scoped PocketBase client without sharing auth stores', async () => {
    const authA = await normalClient(harness.baseUrl, userAEmail)
    const authB = await normalClient(harness.baseUrl, userBEmail)
    const eventA = createEvent()
    const eventB = createEvent()
    const config = runtime(harness.baseUrl)

    const pbA = getRequestPocketBase(eventA, config, authA.pb.authStore.token)
    const pbB = getRequestPocketBase(eventB, config, authB.pb.authStore.token)

    expect(pbA).not.toBe(pbB)
    await expect(pbA.collection('users').authRefresh()).resolves.toMatchObject({ record: { id: authA.user.id } })
    await expect(pbB.collection('users').authRefresh()).resolves.toMatchObject({ record: { id: authB.user.id } })
    expect(pbA.authStore.record?.id).toBe(authA.user.id)
    expect(pbB.authStore.record?.id).toBe(authB.user.id)
  })

  it('rejects incompatible auth intent on a memoized request client', async () => {
    const authA = await normalClient(harness.baseUrl, userAEmail)
    const authB = await normalClient(harness.baseUrl, userBEmail)
    const config = runtime(harness.baseUrl)
    const anonymousFirst = createEvent()
    const authenticatedFirst = createEvent()
    const repeatedToken = createEvent()

    const anonymousClient = getRequestPocketBase(anonymousFirst, config)
    expect(() => getRequestPocketBase(anonymousFirst, config, authA.pb.authStore.token)).toThrowError(
      'different auth intent',
    )
    expect(getRequestPocketBase(anonymousFirst, config)).toBe(anonymousClient)

    const authenticatedClient = getRequestPocketBase(authenticatedFirst, config, authA.pb.authStore.token)
    expect(() => getRequestPocketBase(authenticatedFirst, config)).toThrowError(
      'different auth intent',
    )
    expect(() => getRequestPocketBase(authenticatedFirst, config, authB.pb.authStore.token)).toThrowError(
      'different auth token',
    )

    expect(getRequestPocketBase(repeatedToken, config, authA.pb.authStore.token)).toBe(
      getRequestPocketBase(repeatedToken, config, authA.pb.authStore.token),
    )
    expect(authenticatedClient.authStore.token).toBe(authA.pb.authStore.token)
  })

  it('uses cookie flags required for explicit development HTTP mode', () => {
    const config = runtime(harness.baseUrl)
    expect(getSessionConfig(config)).toEqual({
      appOrigin: 'http://localhost:3000',
      cookieName: 'kunai_session',
      secure: false,
    })

    expect(sessionCookieOptions(config, 'not-a-jwt')).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
    })
  })

  it('uses host-only secure cookie settings for production HTTPS mode', () => {
    const config = { pocketbaseUrl: harness.baseUrl, appOrigin: 'https://kunai.example.test', sessionCookieMode: 'secure' }
    const { controller, jar } = createCookieJar()
    setSessionCookie({ event: createEvent(), runtimeConfig: config, cookies: controller }, 'not-a-jwt')

    const cookie = jar.get('__Host-kunai_session')
    expect(cookie).toBeDefined()
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', secure: true })
    expect(cookie?.options).not.toHaveProperty('domain')
  })

  it('logs in with valid credentials and returns only the safe session DTO', async () => {
    const { controller, jar } = createCookieJar()
    const envelope = await loginWithPassword({
      event: createEvent(),
      runtimeConfig: runtime(harness.baseUrl),
      cookies: controller,
    }, { email: userAEmail, password: USER_PASSWORD })

    expect(envelope.session).toMatchObject({
      displayName: 'User A',
      avatarKey: 'fixture-a',
      onboardingCompleted: false,
    })
    expect(envelope.session).not.toHaveProperty('token')
    expect(envelope.session).not.toHaveProperty('password')
    const cookie = jar.get('kunai_session')
    expect(cookie?.value).toBeTruthy()
    expect(JSON.stringify(envelope)).not.toContain(cookie?.value ?? 'missing-token')
  })

  it('rejects invalid login safely without leaking credentials or tokens', async () => {
    const { controller } = createCookieJar()
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const password = 'wrong-password-secret'

    await expect(loginWithPassword({
      event: createEvent(),
      runtimeConfig: runtime(harness.baseUrl),
      cookies: controller,
    }, { email: userAEmail, password })).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_credentials',
    })

    expect(logSpy).not.toHaveBeenCalled()
    expect(secretFreeString('Invalid email or password.', [password, userAEmail])).toBe(true)
    expect(secretFreeString(undefined, [password])).toBe(true)
    logSpy.mockRestore()
  })

  it('reports transient login outage without labeling credentials invalid or clearing an existing session', async () => {
    const authA = await normalClient(harness.baseUrl, userAEmail)
    const { controller, jar } = createCookieJar({ kunai_session: authA.pb.authStore.token })

    await expect(loginWithPassword({
      event: createEvent(),
      runtimeConfig: runtime('http://127.0.0.1:1'),
      cookies: controller,
    }, { email: userAEmail, password: USER_PASSWORD })).rejects.toMatchObject({
      statusCode: 503,
      code: 'session_unavailable',
    })

    expect(jar.get('kunai_session')).toMatchObject({ value: authA.pb.authStore.token })
    expect(jar.get('kunai_session')?.deleted).not.toBe(true)
  })

  it('restores and refreshes a valid cookie-backed session without exposing the token', async () => {
    const authA = await normalClient(harness.baseUrl, userAEmail)
    const { controller, jar } = createCookieJar({ kunai_session: authA.pb.authStore.token })
    const event = createEvent()
    const envelope = await resolveSession({
      event,
      runtimeConfig: runtime(harness.baseUrl),
      cookies: controller,
    })

    expect(event.context.pocketBaseAuthToken).toBe(jar.get('kunai_session')?.value)
    expect(envelope.session?.id).toBe(authA.user.id)
    expect(envelope.session).not.toHaveProperty('token')
    expect(jar.get('kunai_session')?.value).toBeTruthy()
    expect(JSON.stringify(envelope)).not.toContain(jar.get('kunai_session')?.value ?? 'missing-token')
  })

  it('clears an invalid or expired session cookie', async () => {
    const { controller, jar } = createCookieJar({ kunai_session: 'invalid.expired.token' })
    const envelope = await resolveSession({
      event: createEvent(),
      runtimeConfig: runtime(harness.baseUrl),
      cookies: controller,
    })

    expect(envelope.session).toBeNull()
    expect(jar.get('kunai_session')?.deleted).toBe(true)
  })

  it('preserves the cookie when session refresh cannot reach PocketBase', async () => {
    const authA = await normalClient(harness.baseUrl, userAEmail)
    const { controller, jar } = createCookieJar({ kunai_session: authA.pb.authStore.token })

    await expect(resolveSession({
      event: createEvent(),
      runtimeConfig: runtime('http://127.0.0.1:1'),
      cookies: controller,
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'session_unavailable',
    })

    expect(jar.get('kunai_session')).toMatchObject({ value: authA.pb.authStore.token })
    expect(jar.get('kunai_session')?.deleted).not.toBe(true)
  })

  it('restores the preserved session after a transient refresh outage recovers', async () => {
    const authA = await normalClient(harness.baseUrl, userAEmail)
    const { controller, jar } = createCookieJar({ kunai_session: authA.pb.authStore.token })

    await expect(resolveSession({
      event: createEvent(),
      runtimeConfig: runtime('http://127.0.0.1:1'),
      cookies: controller,
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'session_unavailable',
    })

    const envelope = await resolveSession({
      event: createEvent(),
      runtimeConfig: runtime(harness.baseUrl),
      cookies: controller,
    })

    expect(envelope.session?.id).toBe(authA.user.id)
    expect(jar.get('kunai_session')?.value).toBeTruthy()
    expect(jar.get('kunai_session')?.deleted).not.toBe(true)
  })

  it('allows same-request session resolution to retry after a transient refresh outage', async () => {
    const authA = await normalClient(harness.baseUrl, userAEmail)
    const { controller, jar } = createCookieJar({ kunai_session: authA.pb.authStore.token })
    const event = createEvent()

    await expect(resolveSession({
      event,
      runtimeConfig: runtime('http://127.0.0.1:1'),
      cookies: controller,
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'session_unavailable',
    })

    const envelope = await resolveSession({
      event,
      runtimeConfig: runtime(harness.baseUrl),
      cookies: controller,
    })

    expect(envelope.session?.id).toBe(authA.user.id)
    expect(event.context.pocketBaseAuthToken).toBe(jar.get('kunai_session')?.value)
  })

  it('logout clears cookie and request auth store without promising global revocation', async () => {
    const authA = await normalClient(harness.baseUrl, userAEmail)
    const event = createEvent()
    const { controller, jar } = createCookieJar({ kunai_session: authA.pb.authStore.token })
    const pb = getRequestPocketBase(event, runtime(harness.baseUrl), authA.pb.authStore.token)
    expect(pb.authStore.token).toBe(authA.pb.authStore.token)

    logoutSession({ event, runtimeConfig: runtime(harness.baseUrl), cookies: controller })

    expect(pb.authStore.token).toBe('')
    expect(jar.get('kunai_session')?.deleted).toBe(true)
  })

  it('keeps concurrent User A and User B session restoration isolated', async () => {
    const authA = await normalClient(harness.baseUrl, userAEmail)
    const authB = await normalClient(harness.baseUrl, userBEmail)
    const sessionA = resolveSession({
      event: createEvent(),
      runtimeConfig: runtime(harness.baseUrl),
      cookies: createCookieJar({ kunai_session: authA.pb.authStore.token }).controller,
    })
    const sessionB = resolveSession({
      event: createEvent(),
      runtimeConfig: runtime(harness.baseUrl),
      cookies: createCookieJar({ kunai_session: authB.pb.authStore.token }).controller,
    })

    await expect(Promise.all([sessionA, sessionB])).resolves.toMatchObject([
      { session: { id: authA.user.id, displayName: 'User A' } },
      { session: { id: authB.user.id, displayName: 'User B' } },
    ])
  })

  it('rejects cross-origin unsafe requests and permits configured same-origin requests', () => {
    const config = runtime(harness.baseUrl)
    expect(() => validateSameOrigin(headerReader({ origin: 'http://evil.example.test', 'sec-fetch-site': 'cross-site' }), config)).toThrowError('Request origin')
    expect(() => validateSameOrigin(headerReader({ origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' }), config)).not.toThrow()
  })

  it('keeps the PocketBase endpoint out of public Nuxt runtime config', async () => {
    const source = await readFile('nuxt.config.ts', 'utf8')
    expect(source).toContain('runtimeConfig')
    expect(source).toContain('pocketbaseUrl')
    expect(source).not.toMatch(/public\s*:\s*{[^}]*pocketbaseUrl/s)
  })

  it('can create unauthenticated clients without importing a browser-visible token', () => {
    const pb = createRequestPocketBase(runtime(harness.baseUrl))
    expect(pb.authStore.token).toBe('')
  })

  it('clears cookies with the same security shape used by active sessions', () => {
    const config = runtime(harness.baseUrl)
    const { controller, jar } = createCookieJar({ kunai_session: 'token' })
    clearSessionCookie({ event: createEvent(), runtimeConfig: config, cookies: controller })
    expect(jar.get('kunai_session')).toMatchObject({
      value: '',
      deleted: true,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
    })
  })
})
