import { readFile } from 'node:fs/promises'

import type PocketBase from 'pocketbase'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { SafeSessionDto } from '../../../shared/types/auth'
import type { DefaultLocation } from '../../../shared/types/onboarding'
import { createInitialWidgetConfig } from '../../../shared/validation/onboarding'
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
  readonly seedKey: string
}

interface WidgetRecord {
  readonly id: string
  readonly owner: string
  readonly dashboard: string
  readonly type: string
  readonly seedKey: string
  readonly config: unknown
}

interface CompletionSnapshot {
  readonly user: {
    readonly id: string
    readonly displayName: string
    readonly avatarKey: string
    readonly timezone: string
    readonly onboardingCompleted: boolean
    readonly onboardingCompletedAt?: string
  }
  readonly preferences: readonly { readonly id: string, readonly defaultLocation: unknown }[]
  readonly dashboards: readonly DashboardRecord[]
  readonly widgets: readonly WidgetRecord[]
}

type DurableStage =
  | 'profile-draft'
  | 'preferences'
  | 'home-dashboard'
  | 'search-widget'
  | 'clock-widget'
  | 'weather-widget'
  | 'bookmarks-widget'

type CompleteOnboardingOutcome =
  | { readonly status: 'completed', readonly session: SafeSessionDto & { readonly onboardingCompleted: true } }
  | { readonly status: 'already-complete', readonly session: SafeSessionDto & { readonly onboardingCompleted: true } }

interface CompleteOnboardingInput {
  readonly pb: PocketBase
  readonly ownerId: string
  readonly displayName: string
  readonly avatarKey: string
  readonly timezone: string
  readonly defaultLocation: DefaultLocation
  readonly failureInjection?: {
    readonly failAfterDurableStage?: DurableStage
    readonly expireSessionBeforeFinalization?: true
    readonly loseSuccessResponse?: true
    readonly forceTransientBusy?: true | 'always'
    readonly mutateSeedBeforeFinalization?: true
    readonly deleteSeedBeforeFinalization?: true
  }
}

const completeOnboarding = (
  onboardingService as {
    readonly completeOnboarding?: (input: CompleteOnboardingInput) => Promise<CompleteOnboardingOutcome>
  }
).completeOnboarding

const ensureOnboardingHomeSeed = onboardingService.ensureOnboardingHomeSeed

const defaultLocation: DefaultLocation = null
const validPayload = {
  displayName: 'Completed User',
  avatarKey: 'avatar-01',
  timezone: 'America/New_York',
  defaultLocation,
} as const

const unique = (label: string) => `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const createUserClient = async (admin: PocketBase, baseUrl: string, label: string): Promise<AuthenticatedClient> => {
  const email = `${unique(label)}@example.test`
  const userId = await createNormalUser(admin, email)
  await admin.collection('users').update(userId, {
    displayName: '',
    avatarKey: '',
    timezone: '',
    onboardingCompleted: false,
  })

  return await normalClient(baseUrl, email)
}

const snapshotFor = async (pb: PocketBase, ownerId: string): Promise<CompletionSnapshot> => {
  const [user, preferences, dashboards, widgets] = await Promise.all([
    pb.collection('users').getOne<CompletionSnapshot['user']>(ownerId),
    pb.collection('user_preferences').getFullList<{ readonly id: string, readonly defaultLocation: unknown }>({ filter: `owner = "${ownerId}"`, sort: 'id' }),
    pb.collection('dashboards').getFullList<DashboardRecord>({ filter: `owner = "${ownerId}"`, sort: 'seedKey,id' }),
    pb.collection('dashboard_widgets').getFullList<WidgetRecord>({ filter: `owner = "${ownerId}"`, sort: 'seedKey,id' }),
  ])

  return {
    user,
    preferences,
    dashboards,
    widgets,
  }
}

const seedIds = (snapshot: CompletionSnapshot): readonly string[] => [
  ...snapshot.preferences.map((record) => record.id),
  ...snapshot.dashboards.map((record) => record.id),
  ...snapshot.widgets.map((record) => record.id),
]

const expectNotCompleted = async (pb: PocketBase, ownerId: string) => {
  const snapshot = await snapshotFor(pb, ownerId)
  expect(snapshot.user.onboardingCompleted).toBe(false)
  expect(snapshot.user.onboardingCompletedAt || '').toBe('')
  return snapshot
}

const runCompletion = async (
  client: AuthenticatedClient,
  failureInjection?: CompleteOnboardingInput['failureInjection'],
): Promise<CompleteOnboardingOutcome> => {
  if (!completeOnboarding) {
    throw new Error('completeOnboarding is not implemented; task 12.2 must provide transactional completion, retry, and guard behavior.')
  }

  return await completeOnboarding({
    pb: client.pb,
    ownerId: client.user.id,
    ...validPayload,
    ...(failureInjection ? { failureInjection } : {}),
  })
}

const safeErrorField = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  if (/password|token|secret|bearer|cookie/i.test(value)) return '<redacted-sensitive-string>'
  return value
}

const objectField = (value: unknown, key: string): unknown => (
  typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined
)

const diagnosticOutcome = (outcome: PromiseSettledResult<CompleteOnboardingOutcome>) => {
  if (outcome.status === 'fulfilled') {
    return {
      status: 'fulfilled',
      valueStatus: outcome.value.status,
      session: {
        id: outcome.value.session.id,
        displayName: outcome.value.session.displayName,
        avatarKey: outcome.value.session.avatarKey,
        onboardingCompleted: outcome.value.session.onboardingCompleted,
      },
    }
  }

  const reason = outcome.reason as unknown
  const response = objectField(reason, 'response')
  return {
    status: 'rejected',
    errorType: reason instanceof Error ? reason.constructor.name : typeof reason,
    message: safeErrorField(reason instanceof Error ? reason.message : String(reason)),
    stack: safeErrorField(reason instanceof Error ? reason.stack?.split('\n').slice(0, 8).join('\n') : undefined),
    name: safeErrorField(objectField(reason, 'name')),
    code: safeErrorField(objectField(reason, 'code')),
    statusCode: safeErrorField(objectField(reason, 'statusCode')),
    httpStatus: safeErrorField(objectField(reason, 'status')),
    pocketBaseResponse: typeof response === 'object' && response !== null
      ? {
          code: safeErrorField(objectField(response, 'code')),
          message: safeErrorField(objectField(response, 'message')),
          status: safeErrorField(objectField(response, 'status')),
          dataKeys: Object.keys(response as Record<string, unknown>).filter((key) => !/password|token|secret|bearer|cookie/i.test(key)),
        }
      : undefined,
  }
}

describe('Phase 0002 onboarding completion failure injection and concurrency', () => {
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

  it.each([
    'profile-draft',
    'preferences',
    'home-dashboard',
    'search-widget',
    'clock-widget',
    'weather-widget',
    'bookmarks-widget',
  ] satisfies readonly DurableStage[])('leaves truthful partial state and no false completion after failure following durable stage %s', async (stage) => {
    const client = await createUserClient(admin, harness.baseUrl, `fail-after-${stage}`)

    await expect(runCompletion(client, { failAfterDurableStage: stage })).rejects.toMatchObject({
      code: 'onboarding_completion_failed',
      retryable: true,
    })
    await expectNotCompleted(client.pb, client.user.id)
  })

  it('submits the exact four-operation native final batch under normal user identity and the guard observes earlier batch writes', async () => {
    if (!completeOnboarding) throw new Error('completeOnboarding is not implemented')
    const client = await createUserClient(admin, harness.baseUrl, 'native-final-batch')
    await ensureOnboardingHomeSeed({
      pb: client.pb,
      ownerId: client.user.id,
      timezone: 'Europe/Madrid',
      defaultLocation: null,
    })
    const before = await snapshotFor(client.pb, client.user.id)
    const location = { kind: 'label', label: 'Tokyo' } as const
    const originalCreateBatch = client.pb.createBatch.bind(client.pb)
    const sendSpies: ReturnType<typeof vi.spyOn>[] = []
    const createBatchSpy = vi.spyOn(client.pb, 'createBatch').mockImplementation(() => {
      const batch = originalCreateBatch()
      sendSpies.push(vi.spyOn(batch, 'send'))
      return batch
    })
    let createBatchCalls = 0
    let batchSendCalls = 0

    try {
      const result = await completeOnboarding({
        pb: client.pb,
        ownerId: client.user.id,
        displayName: validPayload.displayName,
        avatarKey: validPayload.avatarKey,
        timezone: 'Asia/Tokyo',
        defaultLocation: location,
      })

      expect(result.status).toBe('completed')
      createBatchCalls = createBatchSpy.mock.calls.length
      batchSendCalls = sendSpies[0]?.mock.calls.length ?? 0
    } finally {
      createBatchSpy.mockRestore()
    }

    const after = await snapshotFor(client.pb, client.user.id)
    expect(createBatchCalls).toBe(1)
    expect(batchSendCalls).toBe(1)
    expect(after.user).toMatchObject({
      displayName: validPayload.displayName,
      avatarKey: validPayload.avatarKey,
      timezone: 'Asia/Tokyo',
      onboardingCompleted: true,
    })
    expect(after.preferences).toHaveLength(1)
    expect(after.preferences[0]).toMatchObject({ id: before.preferences[0]?.id, defaultLocation: location })
    expect(after.widgets.find((widget) => widget.seedKey === 'clock')?.config).toEqual(createInitialWidgetConfig('clock', { timezone: 'Asia/Tokyo' }))
    expect(after.widgets.find((widget) => widget.seedKey === 'weather')?.config).toEqual(createInitialWidgetConfig('weather', { defaultLocation: location }))
    expect(after.widgets.find((widget) => widget.seedKey === 'search')?.config).toEqual(before.widgets.find((widget) => widget.seedKey === 'search')?.config)
    expect(after.widgets.find((widget) => widget.seedKey === 'bookmarks')?.config).toEqual(before.widgets.find((widget) => widget.seedKey === 'bookmarks')?.config)
  })

  it('returns the final durable safe session immediately after completion without requiring a refresh', async () => {
    if (!completeOnboarding) throw new Error('completeOnboarding is not implemented')
    const client = await createUserClient(admin, harness.baseUrl, 'final-session-response')
    await admin.collection('users').update(client.user.id, {
      displayName: 'Old User',
      avatarKey: 'avatar-01',
      timezone: 'UTC',
      onboardingCompleted: false,
    })

    const result = await completeOnboarding({
      pb: client.pb,
      ownerId: client.user.id,
      displayName: 'New User',
      avatarKey: 'avatar-02',
      timezone: 'Europe/Madrid',
      defaultLocation: null,
    })
    const persisted = await snapshotFor(client.pb, client.user.id)

    expect(result.status).toBe('completed')
    expect(persisted.user).toMatchObject({
      displayName: 'New User',
      avatarKey: 'avatar-02',
      timezone: 'Europe/Madrid',
      onboardingCompleted: true,
    })
    expect(result.session).toEqual({
      id: client.user.id,
      displayName: 'New User',
      avatarKey: 'avatar-02',
      onboardingCompleted: true,
    })
    expect(Object.keys(result.session).sort()).toEqual(['avatarKey', 'displayName', 'id', 'onboardingCompleted'])
    expect(JSON.stringify(result.session)).not.toContain('Old User')
    expect(JSON.stringify(result.session)).not.toContain('avatar-01')
    expect(JSON.stringify(result.session)).not.toContain('timezone')
  })

  it('rolls back all preceding native final-batch writes when the final users completion guard rejects', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'native-final-batch-rollback')
    await ensureOnboardingHomeSeed({
      pb: client.pb,
      ownerId: client.user.id,
      timezone: 'Europe/Madrid',
      defaultLocation: null,
    })
    const before = await snapshotFor(client.pb, client.user.id)
    const preferences = before.preferences[0]
    const clock = before.widgets.find((widget) => widget.seedKey === 'clock')
    const weather = before.widgets.find((widget) => widget.seedKey === 'weather')
    const location = { kind: 'label', label: 'Tokyo' } as const
    expect(preferences).toBeDefined()
    expect(clock).toBeDefined()
    expect(weather).toBeDefined()

    const batch = client.pb.createBatch()
    batch.collection('user_preferences').update(preferences!.id, { defaultLocation: location })
    batch.collection('dashboard_widgets').update(clock!.id, { config: { mode: 'local', timezone: 'Asia/Tokyo' } })
    batch.collection('dashboard_widgets').update(weather!.id, { config: { location } })
    batch.collection('users').update(client.user.id, {
      displayName: validPayload.displayName,
      avatarKey: 'forged-avatar-key',
      timezone: 'Asia/Tokyo',
      onboardingCompleted: true,
    })

    await expectClientError(batch.send(), [400, 403])
    const after = await expectNotCompleted(client.pb, client.user.id)
    expect(after.preferences).toEqual(before.preferences)
    expect(after.widgets.find((widget) => widget.seedKey === 'clock')?.config).toEqual(before.widgets.find((widget) => widget.seedKey === 'clock')?.config)
    expect(after.widgets.find((widget) => widget.seedKey === 'weather')?.config).toEqual(before.widgets.find((widget) => widget.seedKey === 'weather')?.config)
  })

  it('returns 401, clears authority, and preserves partial seed when the session expires between stages', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'expired-between-stages')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: validPayload.timezone, defaultLocation })
    const before = await snapshotFor(client.pb, client.user.id)

    await expect(runCompletion(client, { expireSessionBeforeFinalization: true })).rejects.toMatchObject({
      code: 'unauthenticated',
    })
    const after = await expectNotCompleted(admin, client.user.id)
    expect(client.pb.authStore.isValid).toBe(false)
    expect(seedIds(after)).toEqual(seedIds(before))
  })

  it('treats a lost success response as completed on retry without changing the winning seed IDs', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'lost-success')

    await expect(runCompletion(client, { loseSuccessResponse: true })).rejects.toMatchObject({
      code: 'response_lost',
      retryable: true,
    })
    const persistedWinner = await snapshotFor(client.pb, client.user.id)
    expect(persistedWinner.user.onboardingCompleted).toBe(true)

    const retry = await runCompletion(client)
    const afterRetry = await snapshotFor(client.pb, client.user.id)
    expect(retry.status).toBe('already-complete')
    expect(seedIds(afterRetry)).toEqual(seedIds(persistedWinner))
  })

  it('recovers from a real unique conflict by reloading the valid preferences winner instead of duplicating records', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'unique-conflict')
    const originalCollection = client.pb.collection.bind(client.pb)
    let injectedWinnerId = ''
    let observedUniqueConflict = false

    const collectionSpy = vi.spyOn(client.pb, 'collection').mockImplementation((name) => {
      const collection = originalCollection(name)
      if (name !== 'user_preferences') return collection

      return new Proxy(collection, {
        get(target, property, receiver) {
          if (property !== 'create') return Reflect.get(target, property, receiver)

          return async (body: Record<string, unknown>, options?: Record<string, unknown>) => {
            if (!injectedWinnerId) {
              const winner = await admin.collection('user_preferences').create<{ readonly id: string }>({
                owner: client.user.id,
                appearance: 'dark',
                defaultLocation: defaultLocation,
              })
              injectedWinnerId = winner.id
            }

            try {
              return await Reflect.get(target, property, receiver).call(target, body, options)
            } catch (error) {
              observedUniqueConflict = true
              throw error
            }
          }
        },
      })
    })

    try {
      const result = await runCompletion(client)
      const snapshot = await snapshotFor(client.pb, client.user.id)

      expect(result.status).toBe('completed')
      expect(observedUniqueConflict).toBe(true)
      expect(snapshot.user.onboardingCompleted).toBe(true)
      expect(snapshot.preferences).toHaveLength(1)
      expect(snapshot.preferences[0]).toMatchObject({ id: injectedWinnerId, defaultLocation })
      expect(snapshot.dashboards.filter((dashboard) => dashboard.seedKey === 'home')).toHaveLength(1)
      expect(snapshot.widgets).toHaveLength(4)
    } finally {
      collectionSpy.mockRestore()
    }
  })

  it('retries a PocketBase busy/transient failure without reporting false completion before success', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'busy-transient')

    const result = await runCompletion(client, { forceTransientBusy: true })
    const snapshot = await snapshotFor(client.pb, client.user.id)

    expect(result.status).toBe('completed')
    expect(snapshot.user.onboardingCompleted).toBe(true)
  })

  it('bounds persistent retryable conflicts, reports a safe exhaustion error, and preserves reusable partial state', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'busy-exhausted')

    await expect(runCompletion(client, { forceTransientBusy: 'always' })).rejects.toMatchObject({
      code: 'onboarding_retry_exhausted',
      statusCode: 503,
      retryable: true,
    })
    const partial = await expectNotCompleted(client.pb, client.user.id)

    const retry = await runCompletion(client)
    const completed = await snapshotFor(client.pb, client.user.id)

    expect(retry.status).toBe('completed')
    expect(completed.user.onboardingCompleted).toBe(true)
    expect(seedIds(completed)).toEqual(seedIds(partial))
  })

  it('resolves two concurrent identical submits to one completed snapshot and one stable seed identity set', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'concurrent-identical')

    const outcomes = await Promise.allSettled([
      runCompletion(client),
      runCompletion(client),
    ])
    const snapshot = await snapshotFor(client.pb, client.user.id)

    expect(outcomes.every((outcome) => outcome.status === 'fulfilled')).toBe(true)
    expect(snapshot.user.onboardingCompleted).toBe(true)
    expect(snapshot.preferences).toHaveLength(1)
    expect(snapshot.dashboards.filter((dashboard) => dashboard.seedKey === 'home')).toHaveLength(1)
    expect(snapshot.widgets).toHaveLength(4)
  })

  it('resolves two concurrent conflicting submits as first successful finalization wins without mixed profile/location state', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'concurrent-conflicting')
    const otherLocation: DefaultLocation = { kind: 'label', label: 'Tokyo' }

    if (!completeOnboarding) {
      throw new Error('completeOnboarding is not implemented; task 12.2 must provide transactional completion, retry, and guard behavior.')
    }

    const outcomes = await Promise.allSettled([
      completeOnboarding({ pb: client.pb, ownerId: client.user.id, ...validPayload }),
      completeOnboarding({ pb: client.pb, ownerId: client.user.id, ...validPayload, displayName: 'Conflicting User', defaultLocation: otherLocation }),
    ])
    const snapshot = await snapshotFor(client.pb, client.user.id)
    const fulfilledOutcomes = outcomes.filter((outcome) => outcome.status === 'fulfilled')

    if (fulfilledOutcomes.length !== 2) {
      console.error('onboarding-concurrent-conflicting diagnostic', JSON.stringify({
        outcomes: outcomes.map(diagnosticOutcome),
        snapshot: {
          user: {
            id: snapshot.user.id,
            displayName: snapshot.user.displayName,
            avatarKey: snapshot.user.avatarKey,
            timezone: snapshot.user.timezone,
            onboardingCompleted: snapshot.user.onboardingCompleted,
            onboardingCompletedAtPresent: Boolean(snapshot.user.onboardingCompletedAt),
          },
          preferences: snapshot.preferences.map((record) => ({ id: record.id, defaultLocation: record.defaultLocation })),
          dashboards: snapshot.dashboards.map((record) => ({ id: record.id, owner: record.owner, seedKey: record.seedKey })),
          widgets: snapshot.widgets.map((record) => ({ id: record.id, owner: record.owner, dashboard: record.dashboard, type: record.type, seedKey: record.seedKey, config: record.config })),
        },
      }, null, 2))
    }

    expect(fulfilledOutcomes).toHaveLength(2)
    expect(snapshot.user.onboardingCompleted).toBe(true)
    expect(['Completed User', 'Conflicting User']).toContain(snapshot.user.displayName)
    expect(snapshot.preferences).toHaveLength(1)
    expect(snapshot.dashboards.filter((dashboard) => dashboard.seedKey === 'home')).toHaveLength(1)
    expect(snapshot.widgets).toHaveLength(4)

    const fulfilledSessions = outcomes.flatMap((outcome) => outcome.status === 'fulfilled' ? [outcome.value.session] : [])
    expect(fulfilledSessions.map((session) => session.displayName)).toEqual([snapshot.user.displayName, snapshot.user.displayName])

    const expectedLocation = snapshot.user.displayName === 'Conflicting User' ? otherLocation : null
    const weather = snapshot.widgets.find((widget) => widget.seedKey === 'weather')
    expect(snapshot.preferences[0]?.defaultLocation).toEqual(expectedLocation)
    expect(weather?.config).toEqual({ location: expectedLocation })
  })

  it('rejects direct premature onboardingCompleted mutation through normal user credentials', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'premature-completion')

    await expectClientError(
      client.pb.collection('users').update(client.user.id, { onboardingCompleted: true }),
      [400, 403],
    )
    await expectNotCompleted(client.pb, client.user.id)
  })

  it('rejects forged query markers because no client-controlled marker authorizes completion', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'forged-query-marker')

    await expectClientError(
      client.pb.collection('users').update(
        client.user.id,
        { ...validPayload, onboardingCompleted: true },
        { query: { __kunai_onboarding_complete: client.user.id } },
      ),
      [400, 403],
    )
    await expectNotCompleted(client.pb, client.user.id)
  })

  it('rejects forged body markers because no client-controlled marker authorizes completion', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'forged-body-marker')

    await expectClientError(
      client.pb.collection('users').update(client.user.id, {
        ...validPayload,
        __kunai_onboarding_complete: client.user.id,
        onboardingCompleted: true,
      }),
      [400, 403],
    )
    await expectNotCompleted(client.pb, client.user.id)
  })

  it('rejects direct onboardingCompleted mutation even when normal user supplies profile fields but no seed exists', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'premature-completion-profile')

    await expectClientError(
      client.pb.collection('users').update(client.user.id, { ...validPayload, onboardingCompleted: true }),
      [400, 403],
    )
    await expectNotCompleted(client.pb, client.user.id)
  })

  it('rejects direct completion with an incomplete profile despite a valid seed', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'direct-incomplete-profile')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: validPayload.timezone, defaultLocation })

    await expectClientError(
      client.pb.collection('users').update(client.user.id, { ...validPayload, displayName: '', onboardingCompleted: true }),
      [400, 403],
    )
    await expectNotCompleted(client.pb, client.user.id)
  })

  it('rejects direct completion with an unknown avatarKey despite a valid seed', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'direct-unknown-avatar')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: validPayload.timezone, defaultLocation })

    await expectClientError(
      client.pb.collection('users').update(client.user.id, { ...validPayload, avatarKey: 'fixture-avatar-a', onboardingCompleted: true }),
      [400, 403],
    )
    await expectNotCompleted(client.pb, client.user.id)
  })

  it('rejects direct completion with a regex-shaped non-IANA timezone despite a valid seed', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'direct-invalid-timezone')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: validPayload.timezone, defaultLocation })

    await expectClientError(
      client.pb.collection('users').update(client.user.id, { ...validPayload, timezone: 'Mars/Olympus_Mons', onboardingCompleted: true }),
      [400, 403],
    )
    await expectNotCompleted(client.pb, client.user.id)
  })

  it('rejects direct completion when Clock uses the obsolete no-timezone config shape', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'direct-obsolete-clock-config')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: validPayload.timezone, defaultLocation })
    const before = await snapshotFor(client.pb, client.user.id)
    const clock = before.widgets.find((widget) => widget.seedKey === 'clock')
    expect(clock).toBeDefined()
    await admin.collection('dashboard_widgets').update(clock!.id, { config: { mode: 'local' } }, { requestKey: null })

    await expectClientError(
      client.pb.collection('users').update(client.user.id, { ...validPayload, onboardingCompleted: true }),
      [400, 403],
    )
    const after = await expectNotCompleted(client.pb, client.user.id)
    expect(after.user.displayName).toBe(before.user.displayName)
  })

  it('rejects direct completion with a corrupt durable seed and rolls back the profile update', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'direct-corrupt-seed')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: validPayload.timezone, defaultLocation })
    const before = await snapshotFor(client.pb, client.user.id)
    const search = before.widgets.find((widget) => widget.seedKey === 'search')
    expect(search).toBeDefined()
    await client.pb.collection('dashboard_widgets').update(search!.id, { config: { engine: 'corrupt' } }, { requestKey: null })

    await expectClientError(
      client.pb.collection('users').update(client.user.id, { ...validPayload, onboardingCompleted: true }),
      [400, 403],
    )
    const after = await expectNotCompleted(client.pb, client.user.id)
    expect(after.user.displayName).toBe(before.user.displayName)
  })

  it('preserves seed_conflict instead of treating an already completed corrupt seed as success', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'completed-corrupt-seed')
    await runCompletion(client)
    const completed = await snapshotFor(client.pb, client.user.id)
    const search = completed.widgets.find((widget) => widget.seedKey === 'search')
    expect(search).toBeDefined()
    await admin.collection('dashboard_widgets').update(search!.id, { config: { engine: 'corrupt' } }, { requestKey: null })

    await expect(runCompletion(client)).rejects.toMatchObject({
      code: 'seed_conflict',
      retryable: false,
      statusCode: 409,
    })
    const after = await snapshotFor(client.pb, client.user.id)
    expect(after.user.onboardingCompleted).toBe(true)
    expect(after.widgets).toHaveLength(4)
  })

  it('rejects direct completion when a required seed relation belongs to another owner', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'direct-cross-owner-seed')
    const other = await createUserClient(admin, harness.baseUrl, 'direct-cross-owner-other')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: validPayload.timezone, defaultLocation })
    const before = await snapshotFor(client.pb, client.user.id)
    const clock = before.widgets.find((widget) => widget.seedKey === 'clock')
    expect(clock).toBeDefined()
    await admin.collection('dashboard_widgets').update(clock!.id, { owner: other.user.id }, { requestKey: null })

    await expectClientError(
      client.pb.collection('users').update(client.user.id, { ...validPayload, onboardingCompleted: true }),
      [400, 403],
    )
    await expectNotCompleted(client.pb, client.user.id)
  })

  it('assigns onboardingCompletedAt server-side and ignores a forged normal-API timestamp', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'direct-valid-completion')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: validPayload.timezone, defaultLocation })
    const forgedTimestamp = '2000-01-01 00:00:00.000Z'

    const updated = await client.pb.collection('users').update<CompletionSnapshot['user']>(client.user.id, {
      ...validPayload,
      onboardingCompleted: true,
      onboardingCompletedAt: forgedTimestamp,
    })

    expect(updated.onboardingCompleted).toBe(true)
    expect(updated.avatarKey).toBe('avatar-01')
    expect(updated.onboardingCompletedAt).toBeTruthy()
    expect(updated.onboardingCompletedAt).not.toBe(forgedTimestamp)
  })

  it('detects concurrent seed mutation before finalization and does not report completion', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'concurrent-mutation')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: validPayload.timezone, defaultLocation })
    const before = await snapshotFor(client.pb, client.user.id)

    await expect(runCompletion(client, { mutateSeedBeforeFinalization: true })).rejects.toMatchObject({
      code: 'seed_conflict',
      retryable: false,
    })
    const after = await expectNotCompleted(client.pb, client.user.id)
    expect(seedIds(after)).toEqual(seedIds(before))
  })

  it('detects concurrent seed deletion before finalization and does not report completion', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'concurrent-deletion')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: validPayload.timezone, defaultLocation })
    const before = await snapshotFor(client.pb, client.user.id)

    await expect(runCompletion(client, { deleteSeedBeforeFinalization: true })).rejects.toMatchObject({
      code: 'seed_conflict',
      retryable: false,
    })
    const after = await expectNotCompleted(client.pb, client.user.id)
    expect(seedIds(after)).not.toEqual(seedIds(before))
    expect(after.widgets).toHaveLength(3)
  })

  it('completes on retry after valid partial state without losing existing IDs', async () => {
    const client = await createUserClient(admin, harness.baseUrl, 'retry-valid-partial')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: validPayload.timezone, defaultLocation })
    const before = await snapshotFor(client.pb, client.user.id)

    const result = await runCompletion(client)
    const after = await snapshotFor(client.pb, client.user.id)

    expect(result.status).toBe('completed')
    expect(after.user.onboardingCompleted).toBe(true)
    expect(seedIds(after)).toEqual(seedIds(before))
  })

  it('converges a valid retry with changed timezone and location without losing existing seed IDs', async () => {
    if (!completeOnboarding) throw new Error('completeOnboarding is not implemented')
    const client = await createUserClient(admin, harness.baseUrl, 'retry-changed-snapshot')
    await ensureOnboardingHomeSeed({ pb: client.pb, ownerId: client.user.id, timezone: 'Europe/Madrid', defaultLocation: null })
    const before = await snapshotFor(client.pb, client.user.id)
    const changedLocation = { kind: 'label', label: 'Tokyo' } as const

    const result = await completeOnboarding({
      pb: client.pb,
      ownerId: client.user.id,
      displayName: validPayload.displayName,
      avatarKey: validPayload.avatarKey,
      timezone: 'Asia/Tokyo',
      defaultLocation: changedLocation,
    })
    const after = await snapshotFor(client.pb, client.user.id)

    expect(result.status).toBe('completed')
    expect(seedIds(after)).toEqual(seedIds(before))
    expect(after.user.timezone).toBe('Asia/Tokyo')
    expect(after.preferences[0]?.defaultLocation).toEqual(changedLocation)
    expect(after.widgets.find((widget) => widget.seedKey === 'clock')?.config).toEqual({ mode: 'local', timezone: 'Asia/Tokyo' })
    expect(after.widgets.find((widget) => widget.seedKey === 'weather')?.config).toEqual({ location: changedLocation })
  })

  it('does not introduce in-process lock primitives as the concurrency control mechanism', async () => {
    const source = await readFile(new URL('../../../server/utils/onboarding.ts', import.meta.url), 'utf8')

    expect(source).not.toMatch(/mutex|semaphore|inProcessLock|withLock|Map<.*Promise/i)
  })
})
