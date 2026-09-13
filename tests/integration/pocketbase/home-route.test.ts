import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { createApp, toNodeListener } from 'h3'
import PocketBase, { BaseAuthStore } from 'pocketbase'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SafeSessionDto } from '../../../shared/types/auth'
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

const requestHome = async (): Promise<Response> => {
  const { default: homeHandler } = await import('../../../server/api/home.get')
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

const createCompletedUser = async (admin: PocketBase, baseUrl: string, label: string): Promise<AuthenticatedClient> => {
  const email = `home-route-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`
  const userId = await createNormalUser(admin, email)
  await admin.collection('users').update(userId, {
    displayName: `Home Route ${label}`,
    avatarKey: 'avatar-01',
    timezone: 'Europe/Madrid',
    onboardingCompleted: true,
    onboardingCompletedAt: new Date().toISOString(),
  })

  const client = await normalClient(baseUrl, email)
  await client.pb.collection('dashboards').create({
    owner: client.user.id,
    name: 'Home',
    sortOrder: 0,
    seedKey: 'home',
  })

  return client
}

describe('GET /api/home with real PocketBase filters', () => {
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

  it('reads the authenticated user Home seed through PocketBase 0.40.3 using the route filter', async () => {
    const client = await createCompletedUser(admin, harness.baseUrl, 'owner')
    sessionState.session = {
      id: client.user.id,
      displayName: 'Home Route owner',
      avatarKey: 'avatar-01',
      onboardingCompleted: true,
    }
    sessionState.token = client.user.token

    const response = await requestHome()
    const body = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toEqual({
      dashboard: {
        id: expect.any(String),
        name: 'Home',
      },
      initialized: true,
    })
  })

  it('documents that the previous placeholder filter is rejected by PocketBase 0.40.3', async () => {
    const client = await createCompletedUser(admin, harness.baseUrl, 'placeholder')
    const pb = new PocketBase(harness.baseUrl, new BaseAuthStore())
    pb.autoCancellation(false)
    pb.authStore.save(client.user.token, { id: client.user.id })

    await expect(pb.collection('dashboards').getFirstListItem(
      'owner = {:owner} && seedKey = {:seedKey}',
      {
        requestKey: null,
        owner: client.user.id,
        seedKey: 'home',
      },
    )).rejects.toMatchObject({ status: 400 })
  })
})
