import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { createApp, setResponseStatus, type EventHandler, toNodeListener } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

interface DashboardTabDto {
  readonly id: string
  readonly name: string
  readonly sortOrder: number
  readonly isHome: boolean
}

interface DashboardShellDto {
  readonly dashboards: readonly DashboardTabDto[]
  readonly activeDashboardId: string
  readonly activeDashboard: DashboardTabDto
  readonly error?: {
    readonly code?: string
    readonly message?: string
  }
}

interface DashboardRecord {
  id: string
  owner: string
  name: string
  sortOrder: number
  seedKey: string
  archivedAt: string
  token?: string
  collectionId?: string
  created?: string
  updated?: string
}

interface UserPreferenceRecord {
  owner: string
  activeDashboard: string | null
}

const { ownerA, ownerB, state } = vi.hoisted(() => ({
  ownerA: 'user-a',
  ownerB: 'user-b',
  state: {
    session: 'authenticated' as 'authenticated' | 'anonymous' | 'invalid' | 'incomplete',
    pocketBaseUnavailable: false,
    dashboards: [] as DashboardRecord[],
    preferences: [] as UserPreferenceRecord[],
    writes: [] as string[],
    failDashboardUpdateIds: [] as string[],
  },
}))

const dashboard = (id: string, overrides: Partial<DashboardRecord> = {}): DashboardRecord => ({
  id,
  owner: ownerA,
  name: id,
  sortOrder: 0,
  seedKey: '',
  archivedAt: '',
  collectionId: 'dashboards-internal',
  created: '2026-09-15 10:00:00.000Z',
  updated: '2026-09-15 10:00:00.000Z',
  ...overrides,
})

const resetState = (): void => {
  state.session = 'authenticated'
  state.pocketBaseUnavailable = false
  state.writes = []
  state.failDashboardUpdateIds = []
  state.dashboards = [
    dashboard('home-a', { name: 'Home', sortOrder: 0, seedKey: 'home' }),
    dashboard('work-a', { name: 'Work', sortOrder: 1 }),
    dashboard('travel-a', { name: 'Travel', sortOrder: 2 }),
    dashboard('archived-a', { name: 'Archived', sortOrder: 3, archivedAt: '2026-09-15 10:00:00.000Z' }),
    dashboard('home-b', { owner: ownerB, name: 'Other Home', sortOrder: 0, seedKey: 'home', token: 'pb_secret_token' }),
  ]
  state.preferences = [{ owner: ownerA, activeDashboard: 'work-a' }]
}

const cloneState = (): typeof state => JSON.parse(JSON.stringify(state)) as typeof state

const privateNoStore = (response: Response): void => {
  expect(response.headers.get('cache-control')).toContain('private, no-store')
}

const json = async <T>(response: Response): Promise<T> => await response.json() as T

const sameOriginHeaders = {
  Origin: 'http://localhost:3000',
  'Sec-Fetch-Site': 'same-origin',
} as const

const postJson = (body: unknown, headers: HeadersInit = sameOriginHeaders): RequestInit => ({
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const patchJson = (body: unknown, headers: HeadersInit = sameOriginHeaders): RequestInit => ({
  method: 'PATCH',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const expectPublicDashboardShell = (body: DashboardShellDto): void => {
  expect(body).toMatchObject({
    dashboards: expect.any(Array) as unknown[],
    activeDashboardId: expect.any(String) as string,
    activeDashboard: expect.any(Object) as DashboardTabDto,
  })
  const serialized = JSON.stringify(body)
  expect(serialized).not.toContain('owner')
  expect(serialized).not.toContain('seedKey')
  expect(serialized).not.toContain('archivedAt')
  expect(serialized).not.toContain('collectionId')
  expect(serialized).not.toContain('created')
  expect(serialized).not.toContain('updated')
  expect(serialized).not.toContain('token')
  expect(serialized).not.toContain('cookie')
  expect(serialized).not.toContain('pb_secret_token')
}

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
    resolveSession: async () => {
      if (state.session === 'anonymous' || state.session === 'invalid') return { session: null }

      return {
        session: {
          id: ownerA,
          displayName: 'User A',
          avatarKey: 'avatar-01',
          onboardingCompleted: state.session !== 'incomplete',
        },
      }
    },
  }
})

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const unavailable = (): never => {
  throw new Error('PocketBase unavailable: pb_secret_token')
}

vi.mock('../../server/utils/pocketbase-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/pocketbase-client')>()

  return {
    ...original,
    getRequestPocketBase: () => ({
      collection: (name: string) => {
        if (name === 'dashboards') {
          return {
            getFullList: async () => {
              if (state.pocketBaseUnavailable) unavailable()
              return clone(state.dashboards)
            },
            create: async (payload: Record<string, unknown>) => {
              if (state.pocketBaseUnavailable) unavailable()
              const owner = typeof payload.owner === 'string' ? payload.owner : ownerA
              const record: DashboardRecord = {
                id: `dashboard-${state.dashboards.length + 1}`,
                owner,
                name: typeof payload.name === 'string' ? payload.name : '',
                sortOrder: typeof payload.sortOrder === 'number' ? payload.sortOrder : 0,
                seedKey: typeof payload.seedKey === 'string' ? payload.seedKey : '',
                archivedAt: typeof payload.archivedAt === 'string' ? payload.archivedAt : '',
                collectionId: 'dashboards-internal',
                created: '2026-09-15 10:00:00.000Z',
                updated: '2026-09-15 10:00:00.000Z',
              }
              state.writes.push(`dashboards.create:${record.id}`)
              state.dashboards.push(record)
              return clone(record)
            },
            update: async (id: string, payload: Record<string, unknown>) => {
              if (state.pocketBaseUnavailable) unavailable()
              if (state.failDashboardUpdateIds.includes(id)) {
                throw new Error(`PocketBase update outage for ${id}: pb_secret_token`)
              }
              const index = state.dashboards.findIndex((record) => record.id === id)
              if (index === -1) {
                const error = new Error('missing dashboard') as Error & { status: number }
                error.status = 404
                throw error
              }
              const current = state.dashboards[index]!
              const updated: DashboardRecord = {
                ...current,
                name: typeof payload.name === 'string' ? payload.name : current.name,
                sortOrder: typeof payload.sortOrder === 'number' ? payload.sortOrder : current.sortOrder,
                archivedAt: typeof payload.archivedAt === 'string' ? payload.archivedAt : current.archivedAt,
                updated: '2026-09-15 10:00:00.000Z',
              }
              state.writes.push(`dashboards.update:${id}`)
              state.dashboards[index] = updated
              return clone(updated)
            },
          }
        }

        if (name === 'user_preferences') {
          return {
            getFirstListItem: async () => {
              if (state.pocketBaseUnavailable) unavailable()
              const preference = state.preferences.find((record) => record.owner === ownerA)
              if (!preference) {
                const error = new Error('missing preferences') as Error & { status: number }
                error.status = 404
                throw error
              }
              return clone({ id: `preferences-${preference.owner}`, ...preference })
            },
            create: async (payload: Record<string, unknown>) => {
              if (state.pocketBaseUnavailable) unavailable()
              const preference = {
                owner: typeof payload.owner === 'string' ? payload.owner : ownerA,
                activeDashboard: typeof payload.activeDashboard === 'string' ? payload.activeDashboard : null,
              }
              state.writes.push(`preferences.create:${preference.owner}`)
              state.preferences.push(preference)
              return clone({ id: `preferences-${preference.owner}`, ...preference })
            },
            update: async (id: string, payload: Record<string, unknown>) => {
              if (state.pocketBaseUnavailable) unavailable()
              const owner = id.replace('preferences-', '')
              const index = state.preferences.findIndex((record) => record.owner === owner)
              if (index === -1) {
                const error = new Error('missing preferences') as Error & { status: number }
                error.status = 404
                throw error
              }
              const current = state.preferences[index]!
              const updated = {
                ...current,
                activeDashboard: typeof payload.activeDashboard === 'string' ? payload.activeDashboard : current.activeDashboard,
              }
              state.writes.push(`preferences.update:${owner}`)
              state.preferences[index] = updated
              return clone({ id, ...updated })
            },
          }
        }

        throw new Error(`Unexpected collection: ${name}`)
      },
    }),
  }
})

describe('dashboard HTTP route contracts', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    const [
      { default: listHandler },
      { default: createHandler },
      { default: activeHandler },
      { default: reorderHandler },
      { default: renameHandler },
      { default: archiveHandler },
    ] = await Promise.all([
      import('../../server/api/dashboards/index.get') as Promise<{ default: EventHandler }>,
      import('../../server/api/dashboards/index.post') as Promise<{ default: EventHandler }>,
      import('../../server/api/dashboards/active.post') as Promise<{ default: EventHandler }>,
      import('../../server/api/dashboards/reorder.post') as Promise<{ default: EventHandler }>,
      import('../../server/api/dashboards/[id].patch') as Promise<{ default: EventHandler }>,
      import('../../server/api/dashboards/[id]/archive.post') as Promise<{ default: EventHandler }>,
    ])

    const app = createApp()
    app.use((event) => {
      const pathname = event.node.req.url ? new URL(event.node.req.url, baseUrl).pathname : ''
      const method = event.node.req.method ?? 'GET'

      if (pathname === '/api/dashboards/active' && method === 'POST') return activeHandler(event)
      if (pathname === '/api/dashboards/reorder' && method === 'POST') return reorderHandler(event)
      if (/^\/api\/dashboards\/[^/]+\/archive$/.test(pathname) && method === 'POST') return archiveHandler(event)
      if (/^\/api\/dashboards\/[^/]+$/.test(pathname) && method === 'PATCH') return renameHandler(event)
      if (pathname === '/api/dashboards' && method === 'POST') return createHandler(event)
      if (pathname === '/api/dashboards' && method === 'GET') return listHandler(event)

      setResponseStatus(event, 404)
      return { error: { code: 'not_found' } }
    })

    server = createServer(toNodeListener(app))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    if (!server) return
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  })

  beforeEach(() => resetState())

  describe('GET /api/dashboards', () => {
    it('requires authentication and returns 401 for anonymous users', async () => {
      state.session = 'anonymous'

      const response = await fetch(`${baseUrl}/api/dashboards`)
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(401)
      privateNoStore(response)
      expect(body.error?.code).toBe('unauthenticated')
      expect(state.writes).toEqual([])
    })

    it('clears protected data for invalid sessions without leaking internals', async () => {
      state.session = 'invalid'

      const response = await fetch(`${baseUrl}/api/dashboards`)
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(401)
      privateNoStore(response)
      expect(body.error?.code).toBe('unauthenticated')
      expect(JSON.stringify(body)).not.toContain('pb_secret_token')
      expect(state.writes).toEqual([])
    })

    it('returns completed-user dashboard shell DTOs scoped to the current owner', async () => {
      const response = await fetch(`${baseUrl}/api/dashboards`)
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(200)
      privateNoStore(response)
      expect(body.dashboards.map((item) => item.id)).toEqual(['home-a', 'work-a', 'travel-a'])
      expect(body.activeDashboardId).toBe('work-a')
      expectPublicDashboardShell(body)
    })

    it('resolves requested active dashboard without persisting or repairing state', async () => {
      state.preferences[0] = { owner: ownerA, activeDashboard: 'missing-active' }
      const before = cloneState()

      const response = await fetch(`${baseUrl}/api/dashboards?dashboard=travel-a`)
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(200)
      expect(body.activeDashboardId).toBe('travel-a')
      expect(state).toEqual(before)
    })

    it('falls back by stable persisted order while excluding archived and foreign dashboards', async () => {
      state.preferences[0] = { owner: ownerA, activeDashboard: 'archived-a' }

      const response = await fetch(`${baseUrl}/api/dashboards?dashboard=home-b`)
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(200)
      expect(body.activeDashboardId).toBe('home-a')
      expect(body.dashboards.map((item) => item.id)).toEqual(['home-a', 'work-a', 'travel-a'])
      expect(state.writes).toEqual([])
    })

    it('returns sanitized unavailable errors for PocketBase outage without writes', async () => {
      state.pocketBaseUnavailable = true
      const before = cloneState()

      const response = await fetch(`${baseUrl}/api/dashboards`)
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(503)
      privateNoStore(response)
      expect(body.error?.code).toBe('dashboards_unavailable')
      expect(JSON.stringify(body)).not.toContain('PocketBase')
      expect(state).toEqual(before)
    })
  })

  describe('POST /api/dashboards', () => {
    it('requires same-origin before create processing', async () => {
      const response = await fetch(`${baseUrl}/api/dashboards`, postJson({ name: 'Projects' }, { Origin: 'https://evil.example' }))
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(403)
      expect(body.error?.code).toBe('forbidden_origin')
      expect(state.writes).toEqual([])
    })

    it('creates a valid dashboard for the current owner with sanitized shell response', async () => {
      const response = await fetch(`${baseUrl}/api/dashboards`, postJson({ name: '  Projects  ' }))
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(201)
      privateNoStore(response)
      expect(body.dashboards.map((item) => item.name)).toContain('Projects')
      expectPublicDashboardShell(body)
    })

    it('rejects invalid names, over-limit names, owner forgery, and unauthorized fields without partial writes', async () => {
      const before = cloneState()

      for (const payload of [
        { name: '' },
        { name: ' '.repeat(8) },
        { name: 'x'.repeat(81) },
        { name: 'Forged', owner: ownerB },
        { name: 'Forged', seedKey: 'home' },
        { name: 'Forged', sortOrder: -1 },
      ]) {
        const response = await fetch(`${baseUrl}/api/dashboards`, postJson(payload))
        const body = await json<DashboardShellDto>(response)
        expect(response.status).toBe(400)
        expect(body.error?.code).toBe('invalid_dashboard_input')
      }

      expect(state).toEqual(before)
    })
  })

  describe('POST /api/dashboards/active', () => {
    it('persists an owned non-archived active dashboard through explicit mutation only', async () => {
      const response = await fetch(`${baseUrl}/api/dashboards/active`, postJson({ dashboardId: 'travel-a' }))
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(200)
      privateNoStore(response)
      expect(body.activeDashboardId).toBe('travel-a')
      expectPublicDashboardShell(body)
    })

    it('rejects missing, foreign, archived, stale, unknown-field, and cross-origin active selections', async () => {
      for (const [payload, expectedStatus] of [
        [{ dashboardId: 'missing' }, 404],
        [{ dashboardId: 'home-b' }, 404],
        [{ dashboardId: 'archived-a' }, 409],
        [{ dashboardId: '' }, 400],
        [{ dashboardId: 'work-a', owner: ownerB }, 400],
      ] as const) {
        const response = await fetch(`${baseUrl}/api/dashboards/active`, postJson(payload))
        expect(response.status).toBe(expectedStatus)
      }

      const crossOrigin = await fetch(`${baseUrl}/api/dashboards/active`, postJson({ dashboardId: 'work-a' }, { Origin: 'https://evil.example' }))
      expect(crossOrigin.status).toBe(403)
    })
  })

  describe('PATCH /api/dashboards/:id', () => {
    it('renames an owned dashboard including Home while preserving protected fields', async () => {
      const response = await fetch(`${baseUrl}/api/dashboards/home-a`, patchJson({ name: 'Start' }))
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(200)
      privateNoStore(response)
      expect(body.dashboards.find((item) => item.id === 'home-a')).toEqual({ id: 'home-a', name: 'Start', sortOrder: 0, isHome: true })
      expectPublicDashboardShell(body)
    })

    it('rejects foreign, missing, archived, invalid-name, outage, and cross-origin rename attempts safely', async () => {
      for (const [path, payload, expectedStatus] of [
        ['home-b', { name: 'X' }, 404],
        ['missing', { name: 'X' }, 404],
        ['archived-a', { name: 'X' }, 409],
        ['work-a', { name: '' }, 400],
        ['work-a', { name: 'X', sortOrder: 0 }, 400],
      ] as const) {
        const response = await fetch(`${baseUrl}/api/dashboards/${path}`, patchJson(payload))
        expect(response.status).toBe(expectedStatus)
      }

      state.pocketBaseUnavailable = true
      const outage = await fetch(`${baseUrl}/api/dashboards/work-a`, patchJson({ name: 'X' }))
      expect(outage.status).toBe(503)

      const crossOrigin = await fetch(`${baseUrl}/api/dashboards/work-a`, patchJson({ name: 'X' }, { Origin: 'https://evil.example' }))
      expect(crossOrigin.status).toBe(403)
    })
  })

  describe('POST /api/dashboards/reorder', () => {
    it('persists a complete same-owner active dashboard order deterministically', async () => {
      const response = await fetch(`${baseUrl}/api/dashboards/reorder`, postJson({ dashboardIds: ['travel-a', 'home-a', 'work-a'] }))
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(200)
      privateNoStore(response)
      expect(body.dashboards.map((item) => item.id)).toEqual(['travel-a', 'home-a', 'work-a'])
      expectPublicDashboardShell(body)
    })

    it('rejects duplicate, missing, extra, foreign, archived, stale, and cross-origin reorder payloads without mixed-owner state', async () => {
      for (const dashboardIds of [
        ['home-a', 'home-a', 'work-a'],
        ['home-a', 'work-a'],
        ['home-a', 'work-a', 'travel-a', 'extra-a'],
        ['home-a', 'work-a', 'home-b'],
        ['home-a', 'work-a', 'archived-a'],
        ['home-a', 'work-a', 'missing'],
      ]) {
        const response = await fetch(`${baseUrl}/api/dashboards/reorder`, postJson({ dashboardIds }))
        expect(response.status).toBe(409)
      }

      const crossOrigin = await fetch(`${baseUrl}/api/dashboards/reorder`, postJson({ dashboardIds: ['home-a', 'work-a', 'travel-a'] }, { Origin: 'https://evil.example' }))
      expect(crossOrigin.status).toBe(403)
    })

    it('rolls back already-written sortOrder values if a reorder write fails', async () => {
      const before = cloneState()
      state.failDashboardUpdateIds = ['home-a']

      const response = await fetch(`${baseUrl}/api/dashboards/reorder`, postJson({ dashboardIds: ['travel-a', 'home-a', 'work-a'] }))
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(503)
      expect(body.error?.code).toBe('dashboards_unavailable')
      expect(state.dashboards).toEqual(before.dashboards)
    })

  })

  describe('POST /api/dashboards/:id/archive', () => {
    it('archives an allowed non-active dashboard without hard delete and returns the safe shell', async () => {
      const response = await fetch(`${baseUrl}/api/dashboards/travel-a/archive`, postJson({}))
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(200)
      privateNoStore(response)
      expect(body.dashboards.map((item) => item.id)).toEqual(['home-a', 'work-a'])
      expectPublicDashboardShell(body)
    })

    it('archives the active dashboard by selecting the first remaining persisted-order fallback', async () => {
      const response = await fetch(`${baseUrl}/api/dashboards/work-a/archive`, postJson({}))
      const body = await json<DashboardShellDto>(response)

      expect(response.status).toBe(200)
      expect(body.activeDashboardId).toBe('home-a')
      expect(body.dashboards.map((item) => item.id)).toEqual(['home-a', 'travel-a'])
    })

    it('rejects Home, foreign, missing, already archived, last-dashboard, outage, and cross-origin archive attempts without zero-dashboard state', async () => {
      for (const [path, expectedStatus] of [
        ['home-a', 409],
        ['home-b', 404],
        ['missing', 404],
        ['archived-a', 409],
      ] as const) {
        const response = await fetch(`${baseUrl}/api/dashboards/${path}/archive`, postJson({}))
        expect(response.status).toBe(expectedStatus)
      }

      state.dashboards = [dashboard('only-a', { name: 'Only', sortOrder: 0 })]
      const last = await fetch(`${baseUrl}/api/dashboards/only-a/archive`, postJson({}))
      expect(last.status).toBe(409)

      state.pocketBaseUnavailable = true
      const outage = await fetch(`${baseUrl}/api/dashboards/work-a/archive`, postJson({}))
      expect(outage.status).toBe(503)

      const crossOrigin = await fetch(`${baseUrl}/api/dashboards/work-a/archive`, postJson({}, { Origin: 'https://evil.example' }))
      expect(crossOrigin.status).toBe(403)
    })
  })
})
