import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { createApp, toNodeListener } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SafeSessionDto } from '../../shared/types/auth'

const sessionState = vi.hoisted(() => ({
  value: null as SafeSessionDto | null,
}))

const records = vi.hoisted(() => ({
  home: null as Record<string, unknown> | null,
  loadError: null as Error | null,
  readCalls: 0,
  writeCalls: 0,
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

vi.mock('../../server/utils/pocketbase-client', () => ({
  getRequestPocketBase: () => ({
    collection: (name: string) => {
      if (name !== 'dashboards') {
        throw new Error(`Unexpected collection: ${name}`)
      }

      const readHome = async (filter?: string, options?: Record<string, unknown>) => {
        records.readCalls += 1
        expect(filter).toBe(`owner = "${sessionState.value?.id ?? ''}" && seedKey = "home"`)
        expect(options).toEqual({ requestKey: null })
        if (records.loadError) {
          throw records.loadError
        }
        if (!records.home) {
          const error = new Error('missing Home seed') as Error & { status: number }
          error.status = 404
          throw error
        }
        return records.home
      }

      const countWrite = async () => {
        records.writeCalls += 1
      }

      return {
        getFirstListItem: readHome,
        getFullList: async () => [await readHome()],
        create: countWrite,
        update: countWrite,
        delete: countWrite,
      }
    },
  }),
}))

const homeHandlerModulePath = '../../server/api/home.get'

const completedSession: SafeSessionDto = {
  id: 'user-a',
  displayName: 'Ada Lovelace',
  avatarKey: 'avatar-01',
  onboardingCompleted: true,
}

const incompleteSession: SafeSessionDto = {
  ...completedSession,
  onboardingCompleted: false,
}

const validHome = (): Record<string, unknown> => ({
  id: 'home-user-a',
  owner: 'user-a',
  seedKey: 'home',
  name: 'Home',
  sortOrder: 0,
  token: 'home-token-sentinel',
  password: 'home-password-sentinel',
  collectionId: 'dashboards-internal-id',
  created: '2026-09-12 12:00:00.000Z',
})

const requestHome = async (): Promise<Response> => {
  const { default: homeHandler } = await import(homeHandlerModulePath)
  const app = createApp()
  app.use('/api/home', homeHandler)
  const server: Server = createServer(toNodeListener(app))

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo

  try {
    return await fetch(`http://127.0.0.1:${address.port}/api/home`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

describe('GET /api/home', () => {
  beforeEach(() => {
    sessionState.value = completedSession
    records.home = validHome()
    records.loadError = null
    records.readCalls = 0
    records.writeCalls = 0
  })

  it('rejects an anonymous request privately without reading or writing Home data', async () => {
    sessionState.value = null

    const response = await requestHome()
    const body = await response.json() as { error?: { code?: string } }

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body.error?.code).toBe('unauthenticated')
    expect(JSON.stringify(body)).not.toContain('token')
    expect(records.readCalls).toBe(0)
    expect(records.writeCalls).toBe(0)
  })

  it('returns an onboarding-required conflict for an authenticated incomplete user without making Home available', async () => {
    sessionState.value = incompleteSession

    const response = await requestHome()
    const body = await response.json() as { dashboard?: unknown, error?: { code?: string } }

    expect(response.status).toBe(409)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toMatchObject({ error: { code: 'onboarding_required' } })
    expect(body.dashboard).toBeUndefined()
    expect(records.readCalls).toBe(0)
    expect(records.writeCalls).toBe(0)
  })

  it('returns only the authenticated user’s minimal initialized Home DTO without internal fields or future dashboard data', async () => {
    const response = await requestHome()
    const body = await response.json() as Record<string, unknown>
    const serialized = JSON.stringify(body)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toEqual({
      dashboard: {
        id: 'home-user-a',
        name: 'Home',
      },
      initialized: true,
    })
    expect(Object.keys(body).sort()).toEqual(['dashboard', 'initialized'])
    for (const forbiddenValue of [
      'home-token-sentinel',
      'home-password-sentinel',
      'dashboards-internal-id',
      'widgets',
      'layout',
      'grid',
      'tabs',
      'edit',
      'settings',
    ]) {
      expect(serialized).not.toContain(forbiddenValue)
    }
    expect(records.writeCalls).toBe(0)
  })

  it.each([
    ['missing Home', null, null],
    ['wrong owner', { ...validHome(), owner: 'user-b' }, null],
    ['wrong seed identity', { ...validHome(), seedKey: 'travel' }, null],
    ['renamed seed', { ...validHome(), name: 'Travel' }, null],
    ['invalid seed order', { ...validHome(), sortOrder: 1 }, null],
  ] as const)('returns an explicit safe failure for %s without repairing, creating, or hiding the inconsistency', async (_scenario, home, loadError) => {
    records.home = home
    records.loadError = loadError

    const response = await requestHome()
    const body = await response.json() as { dashboard?: unknown, error?: { code?: string, message?: string } }
    const serialized = JSON.stringify(body)

    expect(response.status).toBe(409)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toMatchObject({ error: { code: 'home_inconsistent' } })
    expect(body.dashboard).toBeUndefined()
    expect(serialized).not.toContain('token')
    expect(serialized).not.toContain('SELECT')
    expect(records.writeCalls).toBe(0)
  })

  it('maps Home storage unavailability to a private safe failure without writes', async () => {
    records.loadError = new Error('upstream token SELECT dashboards')

    const response = await requestHome()
    const body = await response.json() as { error?: { code?: string, message?: string } }
    const serialized = JSON.stringify(body)

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toMatchObject({ error: { code: 'home_unavailable' } })
    expect(serialized).not.toContain('token')
    expect(serialized).not.toContain('SELECT')
    expect(records.writeCalls).toBe(0)
  })

  it('never returns another user’s Home even if an unsafe data read yields it', async () => {
    sessionState.value = {
      ...completedSession,
      id: 'user-b',
      displayName: 'Grace Hopper',
    }
    records.home = validHome()

    const response = await requestHome()
    const body = await response.json() as { dashboard?: { id?: string, name?: string }, error?: { code?: string } }
    const serialized = JSON.stringify(body)

    expect(response.status).toBe(409)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toMatchObject({ error: { code: 'home_inconsistent' } })
    expect(body.dashboard).toBeUndefined()
    expect(serialized).not.toContain('home-user-a')
    expect(serialized).not.toContain('Home')
    expect(serialized).not.toContain('home-token-sentinel')
    expect(records.writeCalls).toBe(0)
  })
})
