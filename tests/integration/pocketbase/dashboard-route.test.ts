import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { createApp, toNodeListener } from 'h3'
import type PocketBase from 'pocketbase'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SafeSessionDto } from '../../../shared/types/auth'
import type { DashboardShellDto } from '../../../shared/types/dashboard'
import {
  applyMigrations,
  createNormalUser,
  createPocketBaseHarness,
  normalClient,
  startPocketBase,
  stopPocketBase,
  superuserClient,
  upsertSuperuser,
  type AuthenticatedClient,
  type PocketBaseHarness,
} from './support/harness'

const runtime = vi.hoisted(() => ({
  pocketbaseUrl: '',
  appOrigin: 'http://localhost:3000',
  sessionCookieMode: 'development-http',
}))

const sessionState = vi.hoisted(() => ({
  session: null as SafeSessionDto | null,
  token: '',
}))

vi.mock('../../../server/utils/runtime-config', () => ({
  getRuntimeConfig: () => runtime,
}))

vi.mock('../../../server/utils/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../server/utils/session')>()

  return {
    ...original,
    resolveSession: async ({ event }: { readonly event: { context: Record<string, unknown> } }) => {
      event.context.pocketBaseAuthToken = sessionState.token
      return { session: sessionState.session }
    },
  }
})

const requestDashboards = async (): Promise<Response> => {
  const { default: dashboardsHandler } = await import('../../../server/api/dashboards/index.get')
  const app = createApp()
  app.use('/api/dashboards', dashboardsHandler)
  const server: Server = createServer(toNodeListener(app))

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo

  try {
    return await fetch(`http://127.0.0.1:${address.port}/api/dashboards`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

const createCompletedDashboardUser = async (
  admin: PocketBase,
  baseUrl: string,
): Promise<AuthenticatedClient & { readonly homeDashboardId: string }> => {
  const email = `dashboard-route-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`
  const userId = await createNormalUser(admin, email)
  await admin.collection('users').update(userId, {
    displayName: 'Dashboard Route Owner',
    avatarKey: 'avatar-01',
    timezone: 'Europe/Madrid',
    onboardingCompleted: true,
    onboardingCompletedAt: new Date().toISOString(),
  })

  const client = await normalClient(baseUrl, email)
  const home = await client.pb.collection('dashboards').create({
    owner: client.user.id,
    name: 'Home',
    sortOrder: 0,
    seedKey: 'home',
  })
  await client.pb.collection('user_preferences').create({
    owner: client.user.id,
    activeDashboard: home.id,
  })

  return { ...client, homeDashboardId: home.id }
}

describe('GET /api/dashboards with real PocketBase data', () => {
  let harness: PocketBaseHarness
  let admin: PocketBase

  beforeAll(async () => {
    harness = await createPocketBaseHarness()
    applyMigrations(harness)
    upsertSuperuser(harness)
    await startPocketBase(harness)
    runtime.pocketbaseUrl = harness.baseUrl
    admin = await superuserClient(harness.baseUrl)
  }, 180_000)

  afterAll(async () => {
    await stopPocketBase(harness)
  })

  beforeEach(() => {
    sessionState.session = null
    sessionState.token = ''
  })

  it('returns the real persisted Home dashboard for an authenticated normal user without requiring PocketBase created metadata', async () => {
    const client = await createCompletedDashboardUser(admin, harness.baseUrl)
    sessionState.session = {
      id: client.user.id,
      displayName: 'Dashboard Route Owner',
      avatarKey: 'avatar-01',
      onboardingCompleted: true,
    }
    sessionState.token = client.user.token

    const rawDashboards = await client.pb.collection('dashboards').getFullList({
      filter: `owner = "${client.user.id}" && archivedAt = ""`,
      sort: '+sortOrder,+id',
      requestKey: null,
    })
    expect(rawDashboards).toHaveLength(1)
    expect(rawDashboards[0]).toMatchObject({
      id: client.homeDashboardId,
      owner: client.user.id,
      name: 'Home',
      seedKey: 'home',
      archivedAt: '',
      sortOrder: 0,
    })
    expect(rawDashboards[0]).not.toHaveProperty('created')

    const response = await requestDashboards()
    const body = await response.json() as DashboardShellDto | { readonly error?: { readonly code?: string } }

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).not.toMatchObject({ error: { code: 'dashboards_unavailable' } })
    expect(body).toEqual({
      dashboards: [{
        id: client.homeDashboardId,
        name: 'Home',
        sortOrder: 0,
        isHome: true,
      }],
      activeDashboardId: client.homeDashboardId,
      activeDashboard: {
        id: client.homeDashboardId,
        name: 'Home',
        sortOrder: 0,
        isHome: true,
      },
    })
  })
})
