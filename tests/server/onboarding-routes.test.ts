import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { createApp, toNodeListener } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SafeSessionDto } from '../../shared/types/auth'
import type { DefaultLocation } from '../../shared/types/onboarding'

const sessionState = vi.hoisted(() => ({
  value: null as SafeSessionDto | null,
}))

const records = vi.hoisted(() => ({
  user: {
    displayName: 'Draft User',
    avatarKey: 'avatar-01',
    timezone: 'Europe/Madrid',
  } as Record<string, unknown>,
  preferences: {
    defaultLocation: null as DefaultLocation,
  } as Record<string, unknown> | null,
  writeCalls: 0,
  failUsersGet: false,
}))

vi.mock('../../server/utils/runtime-config', () => ({
  getRuntimeConfig: () => ({
    pocketbaseUrl: 'http://127.0.0.1:8090',
    appOrigin: 'http://localhost:3000',
    sessionCookieMode: 'development-http',
  }),
}))

vi.mock('../../server/utils/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/session')>()

  return {
    ...original,
    resolveSession: async () => ({ session: sessionState.value }),
  }
})

vi.mock('../../server/utils/pocketbase-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/pocketbase-client')>()

  return {
    ...original,
    getRequestPocketBase: () => ({
      collection: (name: string) => {
        if (name === 'users') {
          return {
            getOne: async () => {
              if (records.failUsersGet) {
                throw new Error('PocketBase temporarily unavailable')
              }

              return records.user
            },
            create: async () => {
              records.writeCalls += 1
            },
            update: async () => {
              records.writeCalls += 1
            },
            delete: async () => {
              records.writeCalls += 1
            },
          }
        }

        if (name === 'user_preferences') {
          return {
            getFirstListItem: async () => {
              if (!records.preferences) {
                const error = new Error('missing preferences') as Error & { status: number }
                error.status = 404
                throw error
              }

              return records.preferences
            },
            create: async () => {
              records.writeCalls += 1
            },
            update: async () => {
              records.writeCalls += 1
            },
            delete: async () => {
              records.writeCalls += 1
            },
          }
        }

        throw new Error(`Unexpected collection: ${name}`)
      },
    }),
  }
})

const { default: onboardingHandler } = await import('../../server/api/onboarding/index.get')

const incompleteSession: SafeSessionDto = {
  id: 'user-incomplete',
  displayName: 'Draft User',
  avatarKey: 'avatar-01',
  onboardingCompleted: false,
}

const completedSession: SafeSessionDto = {
  ...incompleteSession,
  onboardingCompleted: true,
}

describe('GET /api/onboarding', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    const app = createApp()
    app.use('/api/onboarding', onboardingHandler)
    server = createServer(toNodeListener(app))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  })

  beforeEach(() => {
    sessionState.value = incompleteSession
    records.user = {
      displayName: '  Draft User  ',
      avatarKey: 'avatar-01',
      timezone: 'Europe/Madrid',
    }
    records.preferences = { defaultLocation: null }
    records.writeCalls = 0
    records.failUsersGet = false
  })

  it('requires an authenticated user', async () => {
    sessionState.value = null

    const response = await fetch(`${baseUrl}/api/onboarding`)
    const body = await response.json() as { error?: { code?: string } }

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toContain('private, no-store')
    expect(body.error?.code).toBe('unauthenticated')
    expect(records.writeCalls).toBe(0)
  })

  it('returns a bounded conflict for a completed user', async () => {
    sessionState.value = completedSession

    const response = await fetch(`${baseUrl}/api/onboarding`)
    const body = await response.json() as { error?: { code?: string, message?: string } }

    expect(response.status).toBe(409)
    expect(response.headers.get('cache-control')).toContain('private, no-store')
    expect(body.error).toMatchObject({
      code: 'onboarding_already_completed',
      message: 'Onboarding has already been completed.',
    })
    expect(records.writeCalls).toBe(0)
  })

  it('lets GET discover completed onboarding even when the session snapshot is stale', async () => {
    records.user = {
      displayName: 'Completed User',
      avatarKey: 'avatar-01',
      timezone: 'Europe/Madrid',
      onboardingCompleted: true,
    }

    const response = await fetch(`${baseUrl}/api/onboarding`)
    const body = await response.json() as { error?: { code?: string, message?: string } }

    expect(response.status).toBe(409)
    expect(response.headers.get('cache-control')).toContain('private, no-store')
    expect(body.error).toEqual({
      code: 'onboarding_already_completed',
      message: 'Onboarding has already been completed.',
    })
    expect(records.writeCalls).toBe(0)
  })

  it('marks temporary load failures as private no-store responses', async () => {
    records.failUsersGet = true

    const response = await fetch(`${baseUrl}/api/onboarding`)
    const body = await response.json() as { error?: { code?: string } }

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toContain('private, no-store')
    expect(body.error?.code).toBe('onboarding_unavailable')
    expect(records.writeCalls).toBe(0)
  })

  it('returns an incomplete user draft without tokens, auth payloads, secrets, or writes', async () => {
    records.preferences = {
      defaultLocation: {
        kind: 'label',
        label: 'Madrid',
      },
    }

    const response = await fetch(`${baseUrl}/api/onboarding`)
    const body = await response.json() as Record<string, unknown>
    const serialized = JSON.stringify(body)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('private, no-store')
    expect(body).toEqual({
      draft: {
        displayName: 'Draft User',
        avatarKey: 'avatar-01',
        timezone: 'Europe/Madrid',
        defaultLocation: {
          kind: 'label',
          label: 'Madrid',
        },
      },
    })
    expect(serialized).not.toContain('token')
    expect(serialized).not.toContain('password')
    expect(serialized).not.toContain('auth')
    expect(records.writeCalls).toBe(0)
  })

  it('maps missing or malformed partial preferences to an explicit unconfigured location', async () => {
    records.preferences = null

    const missing = await fetch(`${baseUrl}/api/onboarding`)
    const missingBody = await missing.json() as { draft?: { defaultLocation?: unknown } }

    expect(missing.status).toBe(200)
    expect(missing.headers.get('cache-control')).toContain('private, no-store')
    expect(missingBody.draft?.defaultLocation).toBeNull()

    records.preferences = {
      defaultLocation: {
        kind: 'geocoded',
        label: 'Madrid',
        provider: 'not-allowed',
      },
    }

    const malformed = await fetch(`${baseUrl}/api/onboarding`)
    const malformedBody = await malformed.json() as { draft?: { defaultLocation?: unknown } }

    expect(malformed.status).toBe(200)
    expect(malformed.headers.get('cache-control')).toContain('private, no-store')
    expect(malformedBody.draft?.defaultLocation).toBeNull()
    expect(records.writeCalls).toBe(0)
  })
})
