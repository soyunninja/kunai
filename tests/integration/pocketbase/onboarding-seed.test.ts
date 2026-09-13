import type PocketBase from 'pocketbase'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { DefaultLocation } from '../../../shared/types/onboarding'
import { createInitialWidgetConfig } from '../../../shared/validation/onboarding'
import * as onboardingService from '../../../server/utils/onboarding'
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
  type AuthenticatedClient,
  type PocketBaseHarness,
} from './support/harness'

interface DashboardRecord {
  readonly id: string
  readonly owner: string
  readonly name: string
  readonly sortOrder: number
  readonly seedKey: string
}

interface WidgetRecord {
  readonly id: string
  readonly owner: string
  readonly dashboard: string
  readonly type: string
  readonly seedKey: string
  readonly config: unknown
  readonly layoutDesktop: unknown
  readonly layoutTablet: unknown
  readonly layoutMobile: unknown
}

interface SeedSnapshot {
  readonly preferencesCount: number
  readonly dashboards: readonly DashboardRecord[]
  readonly widgets: readonly WidgetRecord[]
}

interface EnsureOnboardingHomeSeedInput {
  readonly pb: PocketBase
  readonly ownerId: string
  readonly timezone: string
  readonly defaultLocation: DefaultLocation
}

interface EnsureOnboardingHomeSeedResult {
  readonly status: 'recovered' | 'already-complete'
  readonly homeDashboardId: string
  readonly widgetIdsBySeedKey: Readonly<Record<'search' | 'clock' | 'weather' | 'bookmarks', string>>
}

const ensureOnboardingHomeSeed = (
  onboardingService as {
    readonly ensureOnboardingHomeSeed?: (input: EnsureOnboardingHomeSeedInput) => Promise<EnsureOnboardingHomeSeedResult>
  }
).ensureOnboardingHomeSeed

const expectedSeedKeys = ['search', 'clock', 'weather', 'bookmarks'] as const
const seedTimezone = 'Europe/Madrid'
const seedLocation: DefaultLocation = null

const expectedSeedConfig = (seedKey: typeof expectedSeedKeys[number]) => {
  if (seedKey === 'clock') {
    return { mode: 'local', timezone: seedTimezone }
  }

  if (seedKey === 'weather') {
    return { location: seedLocation }
  }

  if (seedKey === 'search') return createInitialWidgetConfig('search')
  return createInitialWidgetConfig('bookmarks')
}

const unique = (label: string) => `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const createUserClient = async (admin: PocketBase, baseUrl: string, label: string): Promise<AuthenticatedClient> => {
  const email = `${unique(label)}@example.test`
  const userId = await createNormalUser(admin, email)
  await admin.collection('users').update(userId, {
    displayName: 'Seed Matrix User',
    avatarKey: 'fixture-avatar-a',
    timezone: 'Europe/Madrid',
    onboardingCompleted: false,
  })

  return await normalClient(baseUrl, email)
}

const setCompletedProfile = async (admin: PocketBase, userId: string) => {
  await admin.collection('users').update(userId, {
    displayName: 'Completed Seed User',
    avatarKey: 'fixture-avatar-a',
    timezone: 'Europe/Madrid',
    onboardingCompleted: true,
    onboardingCompletedAt: new Date().toISOString(),
  })
}

const createPreferences = async (pb: PocketBase, ownerId: string) => await pb.collection('user_preferences').create({
  owner: ownerId,
  appearance: 'dark',
  defaultLocation: null,
})

const createHome = async (pb: PocketBase, ownerId: string) => await pb.collection('dashboards').create<DashboardRecord>({
  owner: ownerId,
  name: 'Home',
  sortOrder: 0,
  seedKey: 'home',
})

const createCustomDashboard = async (pb: PocketBase, ownerId: string, label = 'Custom') => await pb.collection('dashboards').create<DashboardRecord>({
  owner: ownerId,
  name: label,
  sortOrder: 9,
  seedKey: '',
})

const createWidget = async (
  pb: PocketBase,
  ownerId: string,
  dashboardId: string,
  seedKey: typeof expectedSeedKeys[number],
  config: unknown = expectedSeedConfig(seedKey),
) => await pb.collection('dashboard_widgets').create<WidgetRecord>({
  owner: ownerId,
  dashboard: dashboardId,
  type: seedKey,
  seedKey,
  config,
  layoutDesktop: null,
  layoutTablet: null,
  layoutMobile: null,
})

const snapshotFor = async (pb: PocketBase, ownerId: string): Promise<SeedSnapshot> => {
  const [preferences, dashboards, widgets] = await Promise.all([
    pb.collection('user_preferences').getFullList({ filter: `owner = "${ownerId}"` }),
    pb.collection('dashboards').getFullList<DashboardRecord>({ filter: `owner = "${ownerId}"`, sort: 'seedKey,name' }),
    pb.collection('dashboard_widgets').getFullList<WidgetRecord>({ filter: `owner = "${ownerId}"`, sort: 'seedKey,type' }),
  ])

  return {
    preferencesCount: preferences.length,
    dashboards,
    widgets,
  }
}

const assertRequiredSeed = async (
  pb: PocketBase,
  ownerId: string,
  result: EnsureOnboardingHomeSeedResult,
  expectedExistingIds: readonly string[] = [],
) => {
  const snapshot = await snapshotFor(pb, ownerId)
  const homeDashboards = snapshot.dashboards.filter((dashboard) => dashboard.seedKey === 'home')
  const travelDashboards = snapshot.dashboards.filter((dashboard) => dashboard.name === 'Travel' || dashboard.seedKey === 'travel')
  const devDashboards = snapshot.dashboards.filter((dashboard) => dashboard.name === 'Dev' || dashboard.seedKey === 'dev')

  expect(snapshot.preferencesCount).toBe(1)
  expect(homeDashboards).toHaveLength(1)
  expect(homeDashboards[0]).toMatchObject({
    id: result.homeDashboardId,
    owner: ownerId,
    name: 'Home',
    sortOrder: 0,
    seedKey: 'home',
  })
  expect(travelDashboards).toHaveLength(0)
  expect(devDashboards).toHaveLength(0)

  for (const seedKey of expectedSeedKeys) {
    const matching = snapshot.widgets.filter((widget) => widget.seedKey === seedKey)
    expect(matching).toHaveLength(1)
    expect(matching[0]).toMatchObject({
      id: result.widgetIdsBySeedKey[seedKey],
      owner: ownerId,
      dashboard: result.homeDashboardId,
      type: seedKey,
      config: expectedSeedConfig(seedKey),
      layoutDesktop: null,
      layoutTablet: null,
      layoutMobile: null,
    })
  }

  for (const id of expectedExistingIds) {
    expect([
      ...snapshot.dashboards.map((dashboard) => dashboard.id),
      ...snapshot.widgets.map((widget) => widget.id),
    ]).toContain(id)
  }
}

const expectSnapshotUnchangedAfterConflict = async (client: AuthenticatedClient, before: SeedSnapshot) => {
  await expect(runSeedRecovery(client)).rejects.toMatchObject({ code: 'seed_conflict' })
  const after = await snapshotFor(client.pb, client.user.id)
  expect(after).toEqual(before)
}

const runSeedRecovery = async (client: AuthenticatedClient) => {
  if (!ensureOnboardingHomeSeed) {
    throw new Error('ensureOnboardingHomeSeed is not implemented; task 11.2 must provide the Home seed service.')
  }

  return await ensureOnboardingHomeSeed({
    pb: client.pb,
    ownerId: client.user.id,
    timezone: seedTimezone,
    defaultLocation: seedLocation,
  })
}

describe('Phase 0002 onboarding Home seed recovery matrix', () => {
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

  beforeEach(() => {
    expect(USER_PASSWORD).toBeTruthy()
  })

  it('recovers from a completely empty owner state by creating only Home and the four required seed widgets', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'empty-seed')

    const result = await runSeedRecovery(client)

    expect(result.status).toBe('recovered')
    await assertRequiredSeed(client.pb, client.user.id, result)
  })

  it('recovers from profile-only state without creating Travel, Dev, layouts, positions, or sizes', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'profile-only')

    const result = await runSeedRecovery(client)

    await assertRequiredSeed(client.pb, client.user.id, result)
  })

  it('recovers from preferences-only state while preserving the existing preferences record', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'preferences-only')
    const preferences = await createPreferences(client.pb, client.user.id)

    const result = await runSeedRecovery(client)
    const snapshot = await snapshotFor(client.pb, client.user.id)

    expect(snapshot.preferencesCount).toBe(1)
    expect(snapshot.dashboards.map((dashboard) => dashboard.id)).not.toContain(preferences.id)
    await assertRequiredSeed(client.pb, client.user.id, result)
  })

  it('recovers from Home-only state while preserving the existing Home dashboard ID', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'home-only')
    const home = await createHome(client.pb, client.user.id)

    const result = await runSeedRecovery(client)

    expect(result.homeDashboardId).toBe(home.id)
    await assertRequiredSeed(client.pb, client.user.id, result, [home.id])
  })

  it('recovers when individual widgets are missing and preserves valid existing widget IDs', async () => {
    for (const missingSeedKey of expectedSeedKeys) {
      const client = await createUserClient(admin, harness.baseUrl, `missing-${missingSeedKey}`)
      await createPreferences(client.pb, client.user.id)
      const home = await createHome(client.pb, client.user.id)
      const existingWidgets = await Promise.all(
        expectedSeedKeys
          .filter((seedKey) => seedKey !== missingSeedKey)
          .map((seedKey) => createWidget(client.pb, client.user.id, home.id, seedKey)),
      )

      const result = await runSeedRecovery(client)

      expect(result.homeDashboardId).toBe(home.id)
      await assertRequiredSeed(client.pb, client.user.id, result, [
        home.id,
        ...existingWidgets.map((widget) => widget.id),
      ])
    }
  })

  it('recovers from Home plus partial seed state and keeps exactly one Search, Clock, Weather, and Bookmarks placeholder', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'partial-seed')
    await createPreferences(client.pb, client.user.id)
    const home = await createHome(client.pb, client.user.id)
    const search = await createWidget(client.pb, client.user.id, home.id, 'search')
    const clock = await createWidget(client.pb, client.user.id, home.id, 'clock')

    const result = await runSeedRecovery(client)

    await assertRequiredSeed(client.pb, client.user.id, result, [home.id, search.id, clock.id])
  })

  it('treats replay for an already completed user as read-only and preserves the completed seed', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'completed-replay')
    await createPreferences(client.pb, client.user.id)
    const home = await createHome(client.pb, client.user.id)
    const widgets = await Promise.all(expectedSeedKeys.map((seedKey) => createWidget(client.pb, client.user.id, home.id, seedKey)))
    await setCompletedProfile(admin, client.user.id)
    const before = await snapshotFor(client.pb, client.user.id)

    const result = await runSeedRecovery(client)
    const after = await snapshotFor(client.pb, client.user.id)

    expect(result.status).toBe('already-complete')
    expect(after).toEqual(before)
    await assertRequiredSeed(client.pb, client.user.id, result, [home.id, ...widgets.map((widget) => widget.id)])
  })

  it('rejects corrupt or incompatible same-key seed records instead of deleting or relabeling them', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'corrupt-seed')
    await createPreferences(client.pb, client.user.id)
    const home = await createHome(client.pb, client.user.id)
    const corruptSearch = await createWidget(client.pb, client.user.id, home.id, 'search', { engine: 'custom-provider' })

    await expect(runSeedRecovery(client)).rejects.toMatchObject({
      code: 'seed_conflict',
    })
    const snapshot = await snapshotFor(client.pb, client.user.id)
    expect(snapshot.widgets.map((widget) => widget.id)).toContain(corruptSearch.id)
  })

  it('does not create preferences when preflight finds a corrupt seed and preferences are absent', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'corrupt-no-preferences')
    const home = await createHome(client.pb, client.user.id)
    await createWidget(client.pb, client.user.id, home.id, 'search', { engine: 'custom-provider' })
    const before = await snapshotFor(client.pb, client.user.id)

    expect(before.preferencesCount).toBe(0)
    await expectSnapshotUnchangedAfterConflict(client, before)
  })

  it('does not create Home when preflight finds a corrupt required seed widget before Home exists', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'corrupt-no-home')
    await createPreferences(client.pb, client.user.id)
    const customDashboard = await createCustomDashboard(client.pb, client.user.id, 'Corrupt Seed Container')
    await createWidget(client.pb, client.user.id, customDashboard.id, 'search', { engine: 'custom-provider' })
    const before = await snapshotFor(client.pb, client.user.id)

    expect(before.dashboards.some((dashboard) => dashboard.seedKey === 'home')).toBe(false)
    await expectSnapshotUnchangedAfterConflict(client, before)
  })

  it('does not create additional widgets when preflight finds a later corrupt seed and earlier widgets are absent', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'corrupt-no-extra-widgets')
    await createPreferences(client.pb, client.user.id)
    const home = await createHome(client.pb, client.user.id)
    await createWidget(client.pb, client.user.id, home.id, 'bookmarks', { items: ['not-a-placeholder'] })
    const before = await snapshotFor(client.pb, client.user.id)

    expect(before.widgets.map((widget) => widget.seedKey)).toEqual(['bookmarks'])
    await expectSnapshotUnchangedAfterConflict(client, before)
  })

  it('keeps retry after seed_conflict read-only while the corrupt seed remains', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'corrupt-retry-readonly')
    const home = await createHome(client.pb, client.user.id)
    await createWidget(client.pb, client.user.id, home.id, 'search', { engine: 'custom-provider' })
    const before = await snapshotFor(client.pb, client.user.id)

    await expectSnapshotUnchangedAfterConflict(client, before)
    await expectSnapshotUnchangedAfterConflict(client, before)
  })

  it('does not overwrite customization unrelated to the onboarding seed while recovering missing seed records', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'custom-data')
    const customDashboard = await createCustomDashboard(client.pb, client.user.id, 'Custom Personal Dashboard')
    const customWidget = await client.pb.collection('dashboard_widgets').create<WidgetRecord>({
      owner: client.user.id,
      dashboard: customDashboard.id,
      type: 'search',
      seedKey: '',
      config: { engine: 'custom', label: 'Do not overwrite' },
      layoutDesktop: { x: 1, y: 1, w: 2, h: 1 },
      layoutTablet: null,
      layoutMobile: null,
    })

    const result = await runSeedRecovery(client)
    const customDashboardAfter = await client.pb.collection('dashboards').getOne<DashboardRecord>(customDashboard.id)
    const customWidgetAfter = await client.pb.collection('dashboard_widgets').getOne<WidgetRecord>(customWidget.id)

    expect(customDashboardAfter).toMatchObject({ name: 'Custom Personal Dashboard', sortOrder: 9, seedKey: '' })
    expect(customWidgetAfter).toMatchObject({
      type: 'search',
      seedKey: '',
      config: { engine: 'custom', label: 'Do not overwrite' },
      layoutDesktop: { x: 1, y: 1, w: 2, h: 1 },
    })
    await assertRequiredSeed(client.pb, client.user.id, result, [customDashboard.id, customWidget.id])
  })

  it('is retry-idempotent after partial state recovery and keeps the same seed IDs on the second attempt', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'retry-idempotent')
    await createPreferences(client.pb, client.user.id)
    const home = await createHome(client.pb, client.user.id)
    const weather = await createWidget(client.pb, client.user.id, home.id, 'weather')

    const first = await runSeedRecovery(client)
    const second = await runSeedRecovery(client)

    expect(second).toEqual(first)
    await assertRequiredSeed(client.pb, client.user.id, second, [home.id, weather.id])
  })
})
