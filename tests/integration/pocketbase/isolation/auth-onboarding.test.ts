import type PocketBase from 'pocketbase'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  applyMigrations,
  createNormalUser,
  createPocketBaseHarness,
  expectClientError,
  normalClient,
  startPocketBase,
  stopPocketBase,
  superuserClient,
  upsertSuperuser,
  type AuthenticatedClient,
  type PocketBaseHarness,
} from '../support/harness'

interface UserPair {
  readonly a: AuthenticatedClient
  readonly b: AuthenticatedClient
}

interface DashboardRecord {
  readonly id: string
  readonly owner: string
}

interface WidgetRecord {
  readonly id: string
  readonly owner: string
  readonly dashboard: string
}

const unique = (label: string) => `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const createPair = async (admin: PocketBase, baseUrl: string, label: string): Promise<UserPair> => {
  const suffix = unique(label)
  const emails = [`${suffix}-a@example.test`, `${suffix}-b@example.test`] as const
  await Promise.all(emails.map(async (email) => await createNormalUser(admin, email)))
  const [a, b] = await Promise.all(emails.map(async (email) => await normalClient(baseUrl, email)))
  return { a, b }
}

const createDashboard = async (client: AuthenticatedClient, name: string): Promise<DashboardRecord> => await client.pb.collection('dashboards').create({
  owner: client.user.id,
  name,
  sortOrder: 0,
  seedKey: unique('dashboard'),
}) as DashboardRecord

const createWidget = async (client: AuthenticatedClient, dashboardId: string): Promise<WidgetRecord> => await client.pb.collection('dashboard_widgets').create({
  owner: client.user.id,
  dashboard: dashboardId,
  type: 'search',
  seedKey: unique('widget'),
  config: { version: 1 },
  layoutDesktop: null,
  layoutTablet: null,
  layoutMobile: null,
}) as WidgetRecord

describe('Phase 0002 direct normal-token auth/onboarding isolation matrix', () => {
  let harness: PocketBaseHarness
  let admin: PocketBase

  beforeAll(async () => {
    harness = await createPocketBaseHarness()
    applyMigrations(harness)
    upsertSuperuser(harness)
    await startPocketBase(harness)
    admin = await superuserClient(harness.baseUrl)
  }, 180_000)

  afterAll(async () => {
    await stopPocketBase(harness)
  })

  it('allows each normal user to positively read and update only their own profile, preferences, dashboard, and widget', async () => {
    const { a, b } = await createPair(admin, harness.baseUrl, 'positive-own-access')
    const [dashboardA, dashboardB] = await Promise.all([
      createDashboard(a, 'A Home'),
      createDashboard(b, 'B Home'),
    ])
    const [widgetA, widgetB] = await Promise.all([
      createWidget(a, dashboardA.id),
      createWidget(b, dashboardB.id),
    ])
    const [preferenceA, preferenceB] = await Promise.all([
      a.pb.collection('user_preferences').create({ owner: a.user.id, appearance: 'dark', defaultLocation: null }),
      b.pb.collection('user_preferences').create({ owner: b.user.id, appearance: 'dark', defaultLocation: null }),
    ])

    await expect(a.pb.collection('users').getOne(a.user.id)).resolves.toMatchObject({ id: a.user.id })
    await expect(b.pb.collection('users').update(b.user.id, { displayName: 'User B' })).resolves.toMatchObject({ displayName: 'User B' })
    await expect(a.pb.collection('user_preferences').update(preferenceA.id, { appearance: 'light' })).resolves.toMatchObject({ appearance: 'light' })
    await expect(b.pb.collection('dashboards').update(dashboardB.id, { name: 'B Updated' })).resolves.toMatchObject({ name: 'B Updated' })
    await expect(a.pb.collection('dashboard_widgets').update(widgetA.id, { config: { version: 1, owner: 'a' } })).resolves.toMatchObject({ config: { version: 1, owner: 'a' } })

    const [preferencesA, dashboardsA, widgetsA] = await Promise.all([
      a.pb.collection('user_preferences').getFullList(),
      a.pb.collection('dashboards').getFullList(),
      a.pb.collection('dashboard_widgets').getFullList(),
    ])
    expect(preferencesA.map((record) => record.id)).toContain(preferenceA.id)
    expect(preferencesA.map((record) => record.id)).not.toContain(preferenceB.id)
    expect(dashboardsA.map((record) => record.id)).toContain(dashboardA.id)
    expect(dashboardsA.map((record) => record.id)).not.toContain(dashboardB.id)
    expect(widgetsA.map((record) => record.id)).toContain(widgetA.id)
    expect(widgetsA.map((record) => record.id)).not.toContain(widgetB.id)
  })

  it('denies cross-user reads, updates, and creates with forged owner or dashboard relations while victim records remain unchanged', async () => {
    const { a, b } = await createPair(admin, harness.baseUrl, 'cross-user-negative')
    const dashboardA = await createDashboard(a, 'A Home')
    const dashboardB = await createDashboard(b, 'B Home')
    const widgetA = await createWidget(a, dashboardA.id)
    const widgetB = await createWidget(b, dashboardB.id)
    const preferenceB = await b.pb.collection('user_preferences').create({ owner: b.user.id, appearance: 'dark', defaultLocation: null })

    await expectClientError(a.pb.collection('users').getOne(b.user.id), [403, 404])
    await expectClientError(a.pb.collection('users').update(b.user.id, { displayName: 'Stolen' }), [403, 404])
    await expectClientError(a.pb.collection('user_preferences').getOne(preferenceB.id), [403, 404])
    await expectClientError(a.pb.collection('user_preferences').update(preferenceB.id, { appearance: 'light' }), [403, 404])
    await expectClientError(a.pb.collection('dashboards').getOne(dashboardB.id), [403, 404])
    await expectClientError(a.pb.collection('dashboards').update(dashboardB.id, { name: 'Stolen' }), [403, 404])
    await expectClientError(a.pb.collection('dashboard_widgets').getOne(widgetB.id), [403, 404])
    await expectClientError(a.pb.collection('dashboard_widgets').update(widgetB.id, { type: 'weather' }), [403, 404])

    await expectClientError(a.pb.collection('user_preferences').create({ owner: b.user.id, appearance: 'dark', defaultLocation: null }), [400, 403])
    await expectClientError(a.pb.collection('dashboards').create({ owner: b.user.id, name: 'Forged', sortOrder: 0, seedKey: unique('forged') }), [400, 403])
    await expectClientError(a.pb.collection('dashboard_widgets').create({
      owner: a.user.id,
      dashboard: dashboardB.id,
      type: 'weather',
      seedKey: unique('forged-widget'),
      config: { version: 1 },
      layoutDesktop: null,
      layoutTablet: null,
      layoutMobile: null,
    }), [400, 403])
    await expectClientError(a.pb.collection('dashboard_widgets').update(widgetA.id, { dashboard: dashboardB.id }), [400, 403, 404])

    await expect(b.pb.collection('user_preferences').getOne(preferenceB.id)).resolves.toMatchObject({ appearance: 'dark', owner: b.user.id })
    await expect(b.pb.collection('dashboards').getOne(dashboardB.id)).resolves.toMatchObject({ name: 'B Home', owner: b.user.id })
    await expect(b.pb.collection('dashboard_widgets').getOne(widgetB.id)).resolves.toMatchObject({ type: 'search', dashboard: dashboardB.id, owner: b.user.id })
    await expect(a.pb.collection('dashboard_widgets').getOne(widgetA.id)).resolves.toMatchObject({ dashboard: dashboardA.id, owner: a.user.id })
  })

  it('rejects normal-token sensitive-field mass assignment and direct premature onboarding completion', async () => {
    const { a, b } = await createPair(admin, harness.baseUrl, 'user-mass-assignment')
    const original = await a.pb.collection('users').getOne<Record<string, unknown>>(a.user.id)

    await expectClientError(a.pb.collection('users').update(a.user.id, {
      email: 'attacker@example.test',
      password: 'attacker-password-sentinel',
      passwordConfirm: 'attacker-password-sentinel',
      verified: true,
      onboardingCompleted: true,
      onboardingCompletedAt: '2000-01-01 00:00:00.000Z',
    }), [400, 403])
    await expectClientError(a.pb.collection('users').update(a.user.id, { id: b.user.id }), [400, 403])
    await a.pb.collection('users').update(a.user.id, { owner: b.user.id })

    const reloaded = await a.pb.collection('users').getOne<Record<string, unknown>>(a.user.id)
    expect(reloaded.id).toBe(a.user.id)
    expect(reloaded.email).toBe(original.email)
    expect(reloaded.onboardingCompleted).toBe(false)
    expect(reloaded.onboardingCompletedAt || '').toBe('')
    expect(reloaded.displayName).toBe(original.displayName)
    expect(reloaded.owner).toBeUndefined()
  })
})
