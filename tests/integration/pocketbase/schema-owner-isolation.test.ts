import type PocketBase from 'pocketbase'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  applyMigrations,
  createNormalUser,
  createPocketBaseHarness,
  expectClientError,
  normalClient,
  reverseMigrations,
  startPocketBase,
  stopPocketBase,
  superuserClient,
  upsertSuperuser,
  type AuthenticatedClient,
  type NormalUser,
  type PocketBaseHarness,
} from './support/harness'

interface DashboardRecord {
  id: string
  owner: string
  name: string
  seedKey: string
}

interface WidgetRecord {
  id: string
  owner: string
  dashboard: string
  type: string
  seedKey: string
}

interface ClientPair {
  a: AuthenticatedClient
  b: AuthenticatedClient
}

const uniqueKey = (label: string) => `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const createClientPair = async (admin: PocketBase, baseUrl: string, label: string): Promise<ClientPair> => {
  const suffix = uniqueKey(label)
  const emailA = `${suffix}-a@example.test`
  const emailB = `${suffix}-b@example.test`
  await createNormalUser(admin, emailA)
  await createNormalUser(admin, emailB)

  return {
    a: await normalClient(baseUrl, emailA),
    b: await normalClient(baseUrl, emailB),
  }
}

const createDashboard = async (pb: PocketBase, owner: NormalUser, seedKey = uniqueKey('home')) => {
  return await pb.collection('dashboards').create<DashboardRecord>({
    owner: owner.id,
    name: 'Home',
    sortOrder: 0,
    seedKey,
  })
}

const createWidget = async (
  pb: PocketBase,
  owner: NormalUser,
  dashboardId: string,
  type = 'search',
  seedKey = uniqueKey('search'),
) => {
  return await pb.collection('dashboard_widgets').create<WidgetRecord>({
    owner: owner.id,
    dashboard: dashboardId,
    type,
    seedKey,
    config: { version: 1 },
    layoutDesktop: null,
    layoutTablet: null,
    layoutMobile: null,
  })
}

describe('Phase 0002 PocketBase schema and owner isolation', () => {
  let harness: PocketBaseHarness
  let admin: PocketBase

  beforeAll(async () => {
    harness = await createPocketBaseHarness()

    applyMigrations(harness)
    reverseMigrations(harness)
    applyMigrations(harness)
    upsertSuperuser(harness)
    await startPocketBase(harness)

    admin = await superuserClient(harness.baseUrl)
  }, 180_000)

  afterAll(async () => {
    await stopPocketBase(harness)
  })

  it('applies the reversible Phase 0002 schema exactly once over up/down/up', async () => {
    const users = await admin.collections.getOne('users')
    expect(users.type).toBe('auth')
    expect(users.fields.map((field: { name: string }) => field.name)).toEqual(expect.arrayContaining([
      'displayName',
      'avatarKey',
      'timezone',
      'onboardingCompleted',
      'onboardingCompletedAt',
    ]))

    const preferences = await admin.collections.getOne('user_preferences')
    expect(preferences.fields.map((field: { name: string }) => field.name)).toEqual(expect.arrayContaining([
      'owner',
      'appearance',
      'defaultLocation',
    ]))
    expect(preferences.indexes.join('\n')).toContain('idx_user_preferences_owner')

    const dashboards = await admin.collections.getOne('dashboards')
    expect(dashboards.fields.map((field: { name: string }) => field.name)).toEqual(expect.arrayContaining([
      'owner',
      'name',
      'sortOrder',
      'seedKey',
    ]))
    expect(dashboards.indexes.join('\n')).toContain('idx_dashboards_owner_seed')

    const widgets = await admin.collections.getOne('dashboard_widgets')
    expect(widgets.fields.map((field: { name: string }) => field.name)).toEqual(expect.arrayContaining([
      'owner',
      'dashboard',
      'type',
      'seedKey',
      'config',
      'layoutDesktop',
      'layoutTablet',
      'layoutMobile',
    ]))
    expect(widgets.indexes.join('\n')).toContain('idx_dashboard_widgets_dashboard_seed')
  })

  it('lets a normal user list, view, create, update, and delete only their own preferences', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'preferences-crud')
    const prefA = await a.pb.collection('user_preferences').create({
      owner: a.user.id,
      appearance: 'dark',
      defaultLocation: null,
    })
    const prefB = await b.pb.collection('user_preferences').create({
      owner: b.user.id,
      appearance: 'dark',
      defaultLocation: null,
    })

    const listA = await a.pb.collection('user_preferences').getList(1, 20)
    expect(listA.items.map((item) => item.id)).toContain(prefA.id)
    expect(listA.items.map((item) => item.id)).not.toContain(prefB.id)

    await expect(a.pb.collection('user_preferences').getOne(prefA.id)).resolves.toMatchObject({ id: prefA.id })
    await expectClientError(a.pb.collection('user_preferences').getOne(prefB.id), [403, 404])

    const updated = await a.pb.collection('user_preferences').update(prefA.id, {
      defaultLocation: { kind: 'label', label: 'Kyoto' },
    })
    expect(updated.defaultLocation).toEqual({ kind: 'label', label: 'Kyoto' })

    await a.pb.collection('user_preferences').delete(prefA.id)
    await expectClientError(a.pb.collection('user_preferences').getOne(prefA.id), [403, 404])

    await expectClientError(a.pb.collection('user_preferences').delete(prefB.id), [403, 404])
    await expect(b.pb.collection('user_preferences').getOne(prefB.id)).resolves.toMatchObject({ id: prefB.id })
  })

  it('rejects forged owner create/update and ownership reassignment through direct normal-user API calls', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'forged-owner')
    await expectClientError(
      a.pb.collection('dashboards').create({
        owner: b.user.id,
        name: 'Forged Home',
        sortOrder: 0,
        seedKey: uniqueKey('forged'),
      }),
      [400, 403],
    )

    const dashboardA = await createDashboard(a.pb, a.user)
    await expectClientError(
      a.pb.collection('dashboards').update(dashboardA.id, { owner: b.user.id }),
      [400, 403, 404],
    )
    const reloaded = await a.pb.collection('dashboards').getOne<DashboardRecord>(dashboardA.id)
    expect(reloaded.owner).toBe(a.user.id)
  })

  it('enforces owner isolation for dashboards list/view/create/update/delete', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'dashboards-crud')
    const dashboardA = await createDashboard(a.pb, a.user)
    const dashboardB = await createDashboard(b.pb, b.user)

    const listA = await a.pb.collection('dashboards').getList(1, 50)
    expect(listA.items.map((item) => item.id)).toContain(dashboardA.id)
    expect(listA.items.map((item) => item.id)).not.toContain(dashboardB.id)

    await expect(a.pb.collection('dashboards').getOne(dashboardA.id)).resolves.toMatchObject({ id: dashboardA.id })
    await expectClientError(a.pb.collection('dashboards').getOne(dashboardB.id), [403, 404])

    const updated = await a.pb.collection('dashboards').update<DashboardRecord>(dashboardA.id, { name: 'Updated Home' })
    expect(updated.name).toBe('Updated Home')

    await expectClientError(a.pb.collection('dashboards').update(dashboardB.id, { name: 'Stolen' }), [403, 404])
    await expectClientError(a.pb.collection('dashboards').delete(dashboardB.id), [403, 404])

    await a.pb.collection('dashboards').delete(dashboardA.id)
    await expectClientError(a.pb.collection('dashboards').getOne(dashboardA.id), [403, 404])
  })

  it('enforces owner isolation for dashboard widgets list/view/create/update/delete', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'widgets-crud')
    const dashboardA = await createDashboard(a.pb, a.user)
    const dashboardB = await createDashboard(b.pb, b.user)
    const widgetA = await createWidget(a.pb, a.user, dashboardA.id)
    const widgetB = await createWidget(b.pb, b.user, dashboardB.id)

    const listA = await a.pb.collection('dashboard_widgets').getList(1, 50)
    expect(listA.items.map((item) => item.id)).toContain(widgetA.id)
    expect(listA.items.map((item) => item.id)).not.toContain(widgetB.id)

    await expect(a.pb.collection('dashboard_widgets').getOne(widgetA.id)).resolves.toMatchObject({ id: widgetA.id })
    await expectClientError(a.pb.collection('dashboard_widgets').getOne(widgetB.id), [403, 404])

    const updated = await a.pb.collection('dashboard_widgets').update<WidgetRecord>(widgetA.id, {
      config: { version: 1, placeholder: true },
    })
    expect(updated.config).toEqual({ version: 1, placeholder: true })

    await expectClientError(a.pb.collection('dashboard_widgets').update(widgetB.id, { type: 'weather' }), [403, 404])
    await expectClientError(a.pb.collection('dashboard_widgets').delete(widgetB.id), [403, 404])

    await a.pb.collection('dashboard_widgets').delete(widgetA.id)
    await expectClientError(a.pb.collection('dashboard_widgets').getOne(widgetA.id), [403, 404])
  })

  it('rejects cross-owner dashboard relation create and relation update', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'relation-update')
    const dashboardA = await createDashboard(a.pb, a.user)
    const dashboardA2 = await createDashboard(a.pb, a.user)
    const dashboardB = await createDashboard(b.pb, b.user)

    await expectClientError(
      a.pb.collection('dashboard_widgets').create({
        owner: a.user.id,
        dashboard: dashboardB.id,
        type: 'weather',
        seedKey: uniqueKey('weather'),
        config: { version: 1 },
        layoutDesktop: null,
        layoutTablet: null,
        layoutMobile: null,
      }),
      [400, 403],
    )

    expect(dashboardA2.id).toBeTruthy()
    const widgetA = await createWidget(a.pb, a.user, dashboardA.id)

    await expectClientError(
      a.pb.collection('dashboard_widgets').update(widgetA.id, { dashboard: dashboardB.id }),
      [400, 403, 404],
    )
    const reloaded = await a.pb.collection('dashboard_widgets').getOne<WidgetRecord>(widgetA.id)
    expect(reloaded.dashboard).toBe(dashboardA.id)
  })

  it('enforces unique preferences, Home seed, and widget seed identities per owner/dashboard', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'unique-seeds')
    await a.pb.collection('user_preferences').create({
      owner: a.user.id,
      appearance: 'dark',
      defaultLocation: null,
    })
    await expectClientError(
      a.pb.collection('user_preferences').create({
        owner: a.user.id,
        appearance: 'light',
        defaultLocation: null,
      }),
      [400],
    )

    const homeSeed = uniqueKey('home')
    const dashboardA = await createDashboard(a.pb, a.user, homeSeed)
    await expectClientError(
      a.pb.collection('dashboards').create({
        owner: a.user.id,
        name: 'Duplicate Home',
        sortOrder: 1,
        seedKey: homeSeed,
      }),
      [400],
    )
    await expect(b.pb.collection('dashboards').create({
      owner: b.user.id,
      name: 'Home B',
      sortOrder: 0,
      seedKey: homeSeed,
    })).resolves.toMatchObject({ seedKey: homeSeed })

    const widgetSeed = uniqueKey('clock')
    await createWidget(a.pb, a.user, dashboardA.id, 'clock', widgetSeed)
    await expectClientError(
      a.pb.collection('dashboard_widgets').create({
        owner: a.user.id,
        dashboard: dashboardA.id,
        type: 'clock',
        seedKey: widgetSeed,
        config: { version: 1 },
        layoutDesktop: null,
        layoutTablet: null,
        layoutMobile: null,
      }),
      [400],
    )
  })

  it('allows only self profile updates through normal user credentials', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'profile-self')
    const updated = await a.pb.collection('users').update(a.user.id, {
      displayName: 'User A',
      avatarKey: 'fixture-avatar',
      timezone: 'Europe/Madrid',
    })
    expect(updated.displayName).toBe('User A')
    expect(updated.timezone).toBe('Europe/Madrid')

    await expectClientError(a.pb.collection('users').getOne(b.user.id), [403, 404])
    await expectClientError(a.pb.collection('users').update(b.user.id, { displayName: 'Stolen' }), [403, 404])
  })
})
