import type PocketBase from 'pocketbase'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DefaultLocation } from '../../../shared/types/onboarding'
import * as onboardingService from '../../../server/utils/onboarding'
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
} from './support/harness'

interface DashboardRecord {
  readonly id: string
  readonly owner: string
  readonly name: string
  readonly sortOrder: number
  readonly seedKey: string
  readonly archivedAt?: string
}

interface PreferencesRecord {
  readonly id: string
  readonly owner: string
  readonly activeDashboard?: string
}

interface WidgetRecord {
  readonly id: string
  readonly owner: string
  readonly dashboard: string
  readonly type: string
  readonly seedKey: string
}

interface Phase0002SeedResult {
  readonly homeDashboardId: string
  readonly widgetIdsBySeedKey: Readonly<Record<'search' | 'clock' | 'weather' | 'bookmarks', string>>
}

interface SeededUser {
  readonly client: AuthenticatedClient
  readonly home: DashboardRecord
  readonly preferences: PreferencesRecord
  readonly widgetIds: readonly string[]
}

interface ClientPair {
  readonly a: SeededUser
  readonly b: SeededUser
}

interface EnsureOnboardingHomeSeedInput {
  readonly pb: PocketBase
  readonly ownerId: string
  readonly timezone: string
  readonly defaultLocation: DefaultLocation
}

const ensureOnboardingHomeSeed = onboardingService.ensureOnboardingHomeSeed as (
  input: EnsureOnboardingHomeSeedInput,
) => Promise<Phase0002SeedResult>

const unique = (label: string) => `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const createSeededUser = async (admin: PocketBase, baseUrl: string, label: string): Promise<SeededUser> => {
  const email = `${unique(label)}@example.test`
  const userId = await createNormalUser(admin, email)
  await admin.collection('users').update(userId, {
    displayName: 'Dashboard Lifecycle User',
    avatarKey: 'fixture-avatar-a',
    timezone: 'Europe/Madrid',
    onboardingCompleted: false,
  })

  const client = await normalClient(baseUrl, email)
  const seed = await ensureOnboardingHomeSeed({
    pb: client.pb,
    ownerId: client.user.id,
    timezone: 'Europe/Madrid',
    defaultLocation: null,
  })
  const [home, preferences, widgets] = await Promise.all([
    client.pb.collection('dashboards').getOne<DashboardRecord>(seed.homeDashboardId),
    client.pb.collection('user_preferences').getFirstListItem<PreferencesRecord>(`owner = "${client.user.id}"`),
    client.pb.collection('dashboard_widgets').getFullList<WidgetRecord>({
      filter: `dashboard = "${seed.homeDashboardId}"`,
      sort: 'seedKey',
    }),
  ])

  return {
    client,
    home,
    preferences,
    widgetIds: widgets.map((widget) => widget.id),
  }
}

const createClientPair = async (admin: PocketBase, baseUrl: string, label: string): Promise<ClientPair> => ({
  a: await createSeededUser(admin, baseUrl, `${label}-a`),
  b: await createSeededUser(admin, baseUrl, `${label}-b`),
})

const createDashboard = async (user: SeededUser, name: string, sortOrder: number) => {
  return await user.client.pb.collection('dashboards').create<DashboardRecord>({
    owner: user.client.user.id,
    name,
    sortOrder,
    seedKey: '',
  })
}

const createWidget = async (user: SeededUser, dashboardId: string, seedKey: string) => {
  return await user.client.pb.collection('dashboard_widgets').create<WidgetRecord>({
    owner: user.client.user.id,
    dashboard: dashboardId,
    type: 'search',
    seedKey,
    config: { version: 1 },
    layoutDesktop: null,
    layoutTablet: null,
    layoutMobile: null,
  })
}

const listActiveDashboards = async (user: SeededUser) => {
  const dashboards = await user.client.pb.collection('dashboards').getFullList<DashboardRecord>()
  return dashboards.filter((dashboard) => !dashboard.archivedAt)
}

const expectSameInstant = (actual: string | undefined, expected: string) => {
  expect(actual).toBeTruthy()
  expect(new Date(actual ?? '').toISOString()).toBe(expected)
}

describe('Phase 0003 dashboard lifecycle persistence and direct isolation', () => {
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

  it('adds a nullable archivedAt field and excludes archived dashboards without hard-deleting their widgets', async () => {
    const user = await createSeededUser(admin, harness.baseUrl, 'archive-field')
    const dashboard = await createDashboard(user, 'Archive me', 1)
    const widget = await createWidget(user, dashboard.id, 'archive-widget')

    const collection = await admin.collections.getOne('dashboards')
    expect(collection.fields.map((field: { name: string }) => field.name)).toContain('archivedAt')
    expect(dashboard.archivedAt).toBeFalsy()

    const archivedAt = new Date().toISOString()
    const archivedDashboard = await user.client.pb.collection('dashboards').update<DashboardRecord>(dashboard.id, { archivedAt })
    expect(archivedDashboard).toMatchObject({ id: dashboard.id })
    expectSameInstant(archivedDashboard.archivedAt, archivedAt)

    await expect(listActiveDashboards(user)).resolves.not.toContainEqual(expect.objectContaining({ id: dashboard.id }))
    const persistedDashboard = await user.client.pb.collection('dashboards').getOne<DashboardRecord>(dashboard.id)
    expect(persistedDashboard).toMatchObject({ id: dashboard.id, owner: user.client.user.id })
    expectSameInstant(persistedDashboard.archivedAt, archivedAt)
    await expect(user.client.pb.collection('dashboard_widgets').getOne<WidgetRecord>(widget.id))
      .resolves.toMatchObject({ id: widget.id, owner: user.client.user.id, dashboard: dashboard.id })
  })

  it('persists only a same-owner non-archived activeDashboard reference and keeps a nullable preference safe', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'active-preference')
    const customA = await createDashboard(a, 'A custom', 1)
    const customB = await createDashboard(b, 'B custom', 1)

    const preferences = await a.client.pb.collection('user_preferences').getOne<PreferencesRecord>(a.preferences.id)
    expect(preferences.activeDashboard).toBeFalsy()

    await expect(a.client.pb.collection('user_preferences').update<PreferencesRecord>(a.preferences.id, {
      activeDashboard: customA.id,
    })).resolves.toMatchObject({ id: a.preferences.id, activeDashboard: customA.id })

    await expect(b.client.pb.collection('dashboards').update<DashboardRecord>(customB.id, {
      archivedAt: new Date().toISOString(),
    })).resolves.toMatchObject({ id: customB.id })

    await expectClientError(a.client.pb.collection('user_preferences').update(a.preferences.id, {
      activeDashboard: customB.id,
    }), [400, 403])
    await expectClientError(b.client.pb.collection('user_preferences').update(b.preferences.id, {
      activeDashboard: customB.id,
    }), [400, 403])
  })

  it('validates activeDashboard on user_preferences create under normal user identity', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'active-preference-create')
    const archivedUser = await createSeededUser(admin, harness.baseUrl, 'active-preference-create-archived')
    const emptyUser = await createSeededUser(admin, harness.baseUrl, 'active-preference-create-empty')
    const missingUser = await createSeededUser(admin, harness.baseUrl, 'active-preference-create-missing')
    const customA = await createDashboard(a, 'A custom', 1)
    const archivedDashboard = await createDashboard(archivedUser, 'Archived custom', 1)

    await archivedUser.client.pb.collection('dashboards').update<DashboardRecord>(archivedDashboard.id, {
      archivedAt: new Date().toISOString(),
    })

    await a.client.pb.collection('user_preferences').delete(a.preferences.id)
    await expect(a.client.pb.collection('user_preferences').create<PreferencesRecord>({
      owner: a.client.user.id,
      activeDashboard: customA.id,
    })).resolves.toMatchObject({ owner: a.client.user.id, activeDashboard: customA.id })

    await b.client.pb.collection('user_preferences').delete(b.preferences.id)
    await expectClientError(b.client.pb.collection('user_preferences').create({
      owner: b.client.user.id,
      activeDashboard: customA.id,
    }), [400, 403])

    await archivedUser.client.pb.collection('user_preferences').delete(archivedUser.preferences.id)
    await expectClientError(archivedUser.client.pb.collection('user_preferences').create({
      owner: archivedUser.client.user.id,
      activeDashboard: archivedDashboard.id,
    }), [400, 403])

    await missingUser.client.pb.collection('user_preferences').delete(missingUser.preferences.id)
    await expectClientError(missingUser.client.pb.collection('user_preferences').create({
      owner: missingUser.client.user.id,
      activeDashboard: 'missing-dashboard-id',
    }), [400, 403])

    await emptyUser.client.pb.collection('user_preferences').delete(emptyUser.preferences.id)
    await expect(emptyUser.client.pb.collection('user_preferences').create<PreferencesRecord>({
      owner: emptyUser.client.user.id,
      activeDashboard: '',
    })).resolves.toMatchObject({ owner: emptyUser.client.user.id })

  })

  it('reuses the Phase 0002 Home seed with exactly four widgets while activeDashboard initializes without duplication', async () => {
    const user = await createSeededUser(admin, harness.baseUrl, 'seed-compatibility')

    expect(user.home).toMatchObject({
      owner: user.client.user.id,
      name: 'Home',
      sortOrder: 0,
      seedKey: 'home',
    })
    expect(user.widgetIds).toHaveLength(4)
    expect(await user.client.pb.collection('dashboards').getFullList<DashboardRecord>({
      filter: `owner = "${user.client.user.id}" && seedKey = "home"`,
    })).toHaveLength(1)

    await expect(user.client.pb.collection('user_preferences').update<PreferencesRecord>(user.preferences.id, {
      activeDashboard: user.home.id,
    })).resolves.toMatchObject({ activeDashboard: user.home.id })

    const [homes, widgets] = await Promise.all([
      user.client.pb.collection('dashboards').getFullList<DashboardRecord>({
        filter: `owner = "${user.client.user.id}" && seedKey = "home"`,
      }),
      user.client.pb.collection('dashboard_widgets').getFullList<WidgetRecord>({
        filter: `dashboard = "${user.home.id}"`,
      }),
    ])
    expect(homes).toHaveLength(1)
    expect(widgets).toHaveLength(4)
  })

  it('allows Home rename but rejects Home archive and hard delete', async () => {
    const user = await createSeededUser(admin, harness.baseUrl, 'home-policy')

    await expect(user.client.pb.collection('dashboards').update<DashboardRecord>(user.home.id, {
      name: 'Start',
    })).resolves.toMatchObject({ id: user.home.id, name: 'Start', seedKey: 'home' })
    await expectClientError(user.client.pb.collection('dashboards').update(user.home.id, {
      archivedAt: new Date().toISOString(),
    }), [400, 403])
    await expectClientError(user.client.pb.collection('dashboards').delete(user.home.id), [400, 403])
    await expect(user.client.pb.collection('dashboards').getOne<DashboardRecord>(user.home.id))
      .resolves.toMatchObject({ id: user.home.id, name: 'Start', seedKey: 'home' })
  })

  it('rejects archive of a non-Home user’s last active dashboard', async () => {
    const email = `${unique('last-dashboard')}@example.test`
    const userId = await createNormalUser(admin, email)
    const client = await normalClient(harness.baseUrl, email)
    const onlyDashboard = await client.pb.collection('dashboards').create<DashboardRecord>({
      owner: userId,
      name: 'Only dashboard',
      sortOrder: 0,
      seedKey: '',
    })

    await expectClientError(client.pb.collection('dashboards').update(onlyDashboard.id, {
      archivedAt: new Date().toISOString(),
    }), [400, 403])
    await expect(client.pb.collection('dashboards').getOne<DashboardRecord>(onlyDashboard.id))
      .resolves.toMatchObject({ id: onlyDashboard.id })
  })

  it('keeps normal direct operations owner-isolated while allowing User A to update allowed own fields', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'owner-isolation')
    const dashboardA = await createDashboard(a, 'A private', 1)

    await expect(a.client.pb.collection('dashboards').getOne<DashboardRecord>(dashboardA.id))
      .resolves.toMatchObject({ id: dashboardA.id, owner: a.client.user.id })
    await expect(a.client.pb.collection('dashboards').update<DashboardRecord>(dashboardA.id, {
      name: 'A renamed',
      sortOrder: 2,
    })).resolves.toMatchObject({ id: dashboardA.id, name: 'A renamed', sortOrder: 2 })

    await expectClientError(b.client.pb.collection('dashboards').getOne(dashboardA.id), [403, 404])
    await expectClientError(b.client.pb.collection('dashboards').update(dashboardA.id, { name: 'B stolen' }), [403, 404])
    await expectClientError(b.client.pb.collection('dashboards').update(dashboardA.id, {
      archivedAt: new Date().toISOString(),
    }), [403, 404])
    await expectClientError(b.client.pb.collection('user_preferences').update(b.preferences.id, {
      activeDashboard: dashboardA.id,
    }), [400, 403])
  })

  it('rejects forged owners and cross-owner widget/dashboard relations through normal user tokens', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'forged-relations')
    const dashboardA = await createDashboard(a, 'A dashboard', 1)
    const dashboardB = await createDashboard(b, 'B dashboard', 1)
    const widgetA = await createWidget(a, dashboardA.id, 'owned-widget')

    await expectClientError(a.client.pb.collection('dashboards').create({
      owner: b.client.user.id,
      name: 'Forged owner',
      sortOrder: 2,
      seedKey: '',
    }), [400, 403])
    await expectClientError(a.client.pb.collection('dashboards').update(dashboardA.id, {
      owner: b.client.user.id,
    }), [400, 403, 404])
    await expectClientError(a.client.pb.collection('dashboard_widgets').create({
      owner: a.client.user.id,
      dashboard: dashboardB.id,
      type: 'search',
      seedKey: 'cross-owner-widget',
      config: { version: 1 },
      layoutDesktop: null,
      layoutTablet: null,
      layoutMobile: null,
    }), [400, 403])
    await expectClientError(a.client.pb.collection('dashboard_widgets').update(widgetA.id, {
      dashboard: dashboardB.id,
    }), [400, 403, 404])
  })

  it('keeps sortOrder owner-scoped and preserves widget ownership after a permitted archive', async () => {
    const { a, b } = await createClientPair(admin, harness.baseUrl, 'sort-and-widget-integrity')
    const dashboardA = await createDashboard(a, 'A custom', 1)
    const dashboardB = await createDashboard(b, 'B custom', 1)
    const widget = await createWidget(a, dashboardA.id, 'retained-widget')

    expect(dashboardA.sortOrder).toBe(dashboardB.sortOrder)
    await expect(a.client.pb.collection('dashboards').update<DashboardRecord>(dashboardA.id, {
      archivedAt: new Date().toISOString(),
    })).resolves.toMatchObject({ id: dashboardA.id })
    await expect(a.client.pb.collection('dashboard_widgets').getOne<WidgetRecord>(widget.id))
      .resolves.toMatchObject({ id: widget.id, owner: a.client.user.id, dashboard: dashboardA.id })
    await expectClientError(a.client.pb.collection('user_preferences').update(a.preferences.id, {
      activeDashboard: dashboardA.id,
    }), [400, 403])
  })
})
