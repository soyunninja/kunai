import { ClientResponseError, type RecordModel } from 'pocketbase'

import type { SafeSessionDto } from '../../shared/types/auth'
import type { DefaultLocation, OnboardingDraft, OnboardingDraftEnvelope } from '../../shared/types/onboarding'
import { createInitialWidgetConfig, parseDefaultLocation, type InitialWidgetType } from '../../shared/validation/onboarding'
import { ApiError, toOnboardingApiError } from './api-error'
import { getRequestPocketBase, type RequestEventLike } from './pocketbase-client'
import type { PocketBaseRuntimeConfig } from './pocketbase'
import type { SessionRuntimeConfig } from './session-config'
import { type CookieController, resolveSession } from './session'

interface OnboardingDraftDependencies {
  readonly event: RequestEventLike
  readonly runtimeConfig: PocketBaseRuntimeConfig & SessionRuntimeConfig
  readonly cookies: CookieController
}

type DurableStage =
  | 'profile-draft'
  | 'preferences'
  | 'home-dashboard'
  | 'search-widget'
  | 'clock-widget'
  | 'weather-widget'
  | 'bookmarks-widget'

interface FailureInjection {
  readonly failAfterDurableStage?: DurableStage
  readonly expireSessionBeforeFinalization?: true
  readonly loseSuccessResponse?: true
  readonly forceTransientBusy?: true | 'always'
  readonly mutateSeedBeforeFinalization?: true
  readonly deleteSeedBeforeFinalization?: true
}

export interface EnsureOnboardingHomeSeedInput {
  readonly pb: {
    readonly collection: (name: string) => {
      readonly getOne: <T = RecordModel>(id: string, options?: Record<string, unknown>) => Promise<T>
      readonly getFirstListItem: <T = RecordModel>(filter: string, options?: Record<string, unknown>) => Promise<T>
      readonly getFullList: <T = RecordModel>(options?: Record<string, unknown>) => Promise<T[]>
      readonly create: <T = RecordModel>(body: Record<string, unknown>, options?: Record<string, unknown>) => Promise<T>
    }
  }
  readonly ownerId: string
  readonly timezone: string
  readonly defaultLocation: DefaultLocation
}

interface InternalEnsureOnboardingHomeSeedInput extends EnsureOnboardingHomeSeedInput {
  readonly allowIncompletePlaceholderConfig?: true
  readonly onDurableStage?: (stage: Extract<DurableStage, 'preferences' | 'home-dashboard' | 'search-widget' | 'clock-widget' | 'weather-widget' | 'bookmarks-widget'>) => void
}

export interface EnsureOnboardingHomeSeedResult {
  readonly status: 'recovered' | 'already-complete'
  readonly homeDashboardId: string
  readonly widgetIdsBySeedKey: Readonly<Record<InitialWidgetType, string>>
}

type SeedCollectionClient = ReturnType<EnsureOnboardingHomeSeedInput['pb']['collection']>
type CompleteOnboardingCollectionClient = SeedCollectionClient & {
  readonly update: <T = RecordModel>(id: string, body: Record<string, unknown>, options?: Record<string, unknown>) => Promise<T>
  readonly delete: (id: string, options?: Record<string, unknown>) => Promise<boolean>
}
const mutableCollection = (input: CompleteOnboardingInput, name: string): CompleteOnboardingCollectionClient => input.pb.collection(name)

export interface CompleteOnboardingInput extends Omit<EnsureOnboardingHomeSeedInput, 'pb'> {
  readonly pb: {
    readonly createBatch: () => {
      readonly collection: (name: string) => {
        readonly update: (id: string, body: Record<string, unknown>) => void
        readonly create: (body: Record<string, unknown>) => void
      }
      readonly send: () => Promise<unknown>
    }
    readonly authStore: { readonly clear: () => void }
    readonly collection: (name: string) => CompleteOnboardingCollectionClient
  }
  readonly displayName: string
  readonly avatarKey: string
  readonly failureInjection?: FailureInjection
}

export type CompleteOnboardingResult =
  | { readonly status: 'completed', readonly session: SafeSessionDto & { readonly onboardingCompleted: true } }
  | { readonly status: 'already-complete', readonly session: SafeSessionDto & { readonly onboardingCompleted: true } }

interface SeedDashboardRecord extends RecordModel {
  readonly owner: string
  readonly name: string
  readonly sortOrder: number
  readonly seedKey: string
}

interface SeedWidgetRecord extends RecordModel {
  readonly owner: string
  readonly dashboard: string
  readonly type: string
  readonly seedKey: string
  readonly config: unknown
  readonly layoutDesktop: unknown
  readonly layoutTablet: unknown
  readonly layoutMobile: unknown
}

interface ExistingSeedState {
  readonly preferences: RecordModel | null
  readonly home: SeedDashboardRecord | null
  readonly widgetsBySeedKey: ReadonlyMap<InitialWidgetType, SeedWidgetRecord>
}

const requiredWidgetSeedKeys = ['search', 'clock', 'weather', 'bookmarks'] as const satisfies readonly InitialWidgetType[]
const maximumCompletionAttempts = 3

class OnboardingCompletionError extends ApiError {
  readonly retryable: boolean

  constructor(code: string, message: string, retryable: boolean, statusCode = 409) {
    super(statusCode, code, message)
    this.retryable = retryable
  }
}

const optionalString = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  return trimmed.length <= maxLength ? trimmed : ''
}

const hasStatus = (error: unknown, status: number): boolean => {
  if (error instanceof ClientResponseError) {
    return error.status === status
  }

  return typeof error === 'object' && error !== null && 'status' in error && error.status === status
}

const isRecoverablePocketBaseError = (error: unknown): boolean => (
  [400, 409, 429, 500, 502, 503].some((status) => hasStatus(error, status))
)

const seedConflict = (message = 'Onboarding seed is incompatible with the required initial state.'): OnboardingCompletionError => (
  new OnboardingCompletionError('seed_conflict', message, false)
)

const completionFailure = (): OnboardingCompletionError => (
  new OnboardingCompletionError('onboarding_completion_failed', 'Onboarding completion could not be finalized. Please retry.', true, 503)
)

const retryExhausted = (): OnboardingCompletionError => (
  new OnboardingCompletionError('onboarding_retry_exhausted', 'Onboarding is still busy. Please retry.', true, 503)
)

const stableJson = (value: unknown): string => JSON.stringify(value)
const sameJson = (left: unknown, right: unknown): boolean => stableJson(left) === stableJson(right)
const filterValue = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
const isRecordObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const findFirstOrNull = async <T>(
  collection: { readonly getFirstListItem: <U = T>(filter: string, options?: Record<string, unknown>) => Promise<U> },
  filter: string,
): Promise<T | null> => {
  try {
    return await collection.getFirstListItem<T>(filter, { requestKey: null })
  } catch (error) {
    if (hasStatus(error, 404)) {
      return null
    }

    throw error
  }
}

const draftLocation = (record: RecordModel | null): OnboardingDraft['defaultLocation'] => {
  if (!record || !('defaultLocation' in record)) {
    return null
  }

  try {
    return parseDefaultLocation(record.defaultLocation)
  } catch {
    return null
  }
}

const requestPocketBase = (dependencies: OnboardingDraftDependencies) => getRequestPocketBase(
  dependencies.event,
  dependencies.runtimeConfig,
  dependencies.event.context.pocketBaseAuthToken,
)

const preferencesForOwner = async (dependencies: OnboardingDraftDependencies, ownerId: string): Promise<RecordModel | null> => {
  const pb = requestPocketBase(dependencies)
  try {
    return await pb.collection('user_preferences').getFirstListItem(`owner = "${ownerId}"`, { requestKey: null })
  } catch (error) {
    if (hasStatus(error, 404)) {
      return null
    }
    throw new ApiError(503, 'onboarding_unavailable', 'Onboarding state could not be loaded. Please retry.')
  }
}

const userProfile = async (dependencies: OnboardingDraftDependencies, ownerId: string): Promise<RecordModel> => {
  try {
    return await requestPocketBase(dependencies).collection('users').getOne(ownerId, { requestKey: null })
  } catch {
    throw new ApiError(503, 'onboarding_unavailable', 'Onboarding state could not be loaded. Please retry.')
  }
}

const loadOwnerProfile = async (input: EnsureOnboardingHomeSeedInput): Promise<RecordModel> => {
  try {
    return await input.pb.collection('users').getOne(input.ownerId, { requestKey: null })
  } catch (error) {
    throw toOnboardingApiError(error)
  }
}

const validatePreferences = (preferences: RecordModel, input: EnsureOnboardingHomeSeedInput): void => {
  if (preferences.owner !== input.ownerId) {
    throw seedConflict()
  }
  try {
    parseDefaultLocation(preferences.defaultLocation)
  } catch {
    throw seedConflict()
  }
}

const createMissingPreferences = async (input: InternalEnsureOnboardingHomeSeedInput): Promise<RecordModel> => {
  const preferences = input.pb.collection('user_preferences')
  let created: RecordModel
  try {
    created = await preferences.create({ owner: input.ownerId, appearance: 'dark', defaultLocation: input.defaultLocation }, { requestKey: null })
  } catch (error) {
    const winner = await findFirstOrNull<RecordModel>(preferences, `owner = "${filterValue(input.ownerId)}"`)
    if (winner) {
      validatePreferences(winner, input)
      return winner
    }
    throw error
  }

  input.onDurableStage?.('preferences')
  return created
}

const validateHome = (dashboard: SeedDashboardRecord, ownerId: string): void => {
  if (dashboard.owner !== ownerId || dashboard.seedKey !== 'home' || dashboard.name !== 'Home' || Number(dashboard.sortOrder) !== 0) {
    throw seedConflict()
  }
}

const createMissingHome = async (input: InternalEnsureOnboardingHomeSeedInput): Promise<SeedDashboardRecord> => {
  const dashboards = input.pb.collection('dashboards')
  let created: SeedDashboardRecord
  try {
    created = await dashboards.create<SeedDashboardRecord>({ owner: input.ownerId, name: 'Home', sortOrder: 0, seedKey: 'home' }, { requestKey: null })
  } catch (error) {
    const winner = await findFirstOrNull<SeedDashboardRecord>(dashboards, `owner = "${filterValue(input.ownerId)}" && seedKey = "home"`)
    if (winner) {
      validateHome(winner, input.ownerId)
      return winner
    }
    throw error
  }

  input.onDurableStage?.('home-dashboard')
  return created
}

const seedWidgetConfig = (seedKey: InitialWidgetType, input: EnsureOnboardingHomeSeedInput): unknown => {
  if (seedKey === 'clock') return createInitialWidgetConfig('clock', { timezone: input.timezone })
  if (seedKey === 'weather') return createInitialWidgetConfig('weather', { defaultLocation: input.defaultLocation })
  if (seedKey === 'search') return createInitialWidgetConfig('search')
  return createInitialWidgetConfig('bookmarks')
}

const validIncompletePlaceholderConfig = (widget: SeedWidgetRecord, seedKey: InitialWidgetType): boolean => {
  if (seedKey === 'search') return sameJson(widget.config, createInitialWidgetConfig('search'))
  if (seedKey === 'bookmarks') return sameJson(widget.config, createInitialWidgetConfig('bookmarks'))
  if (!isRecordObject(widget.config)) return false
  if (seedKey === 'clock') return widget.config.mode === 'local'
  return 'location' in widget.config
}

const validateSeedWidget = (
  widget: SeedWidgetRecord,
  ownerId: string,
  homeDashboardId: string,
  seedKey: InitialWidgetType,
  input: InternalEnsureOnboardingHomeSeedInput,
): void => {
  const configIsValid = input.allowIncompletePlaceholderConfig
    ? validIncompletePlaceholderConfig(widget, seedKey)
    : sameJson(widget.config, seedWidgetConfig(seedKey, input))

  if (widget.owner !== ownerId || widget.dashboard !== homeDashboardId || widget.type !== seedKey || widget.seedKey !== seedKey || !configIsValid || widget.layoutDesktop !== null || widget.layoutTablet !== null || widget.layoutMobile !== null) {
    throw seedConflict()
  }
}

const createMissingSeedWidget = async (
  input: InternalEnsureOnboardingHomeSeedInput,
  homeDashboardId: string,
  seedKey: InitialWidgetType,
): Promise<SeedWidgetRecord> => {
  const widgets = input.pb.collection('dashboard_widgets')
  let created: SeedWidgetRecord
  try {
    created = await widgets.create<SeedWidgetRecord>({
      owner: input.ownerId,
      dashboard: homeDashboardId,
      type: seedKey,
      seedKey,
      config: seedWidgetConfig(seedKey, input),
      layoutDesktop: null,
      layoutTablet: null,
      layoutMobile: null,
    }, { requestKey: null })
  } catch (error) {
    const winner = await findFirstOrNull<SeedWidgetRecord>(widgets, `dashboard = "${filterValue(homeDashboardId)}" && seedKey = "${seedKey}"`)
    if (winner) {
      validateSeedWidget(winner, input.ownerId, homeDashboardId, seedKey, input)
      return winner
    }
    throw error
  }

  input.onDurableStage?.(`${seedKey}-widget`)
  return created
}

const relevantWidgetSeedKeyFilter = `(${requiredWidgetSeedKeys.map((seedKey) => `seedKey = "${seedKey}"`).join(' || ')})`

const loadExistingSeedState = async (input: InternalEnsureOnboardingHomeSeedInput): Promise<ExistingSeedState> => {
  const ownerFilter = `owner = "${filterValue(input.ownerId)}"`
  const [preferences, home] = await Promise.all([
    findFirstOrNull<RecordModel>(input.pb.collection('user_preferences'), ownerFilter),
    findFirstOrNull<SeedDashboardRecord>(input.pb.collection('dashboards'), `${ownerFilter} && seedKey = "home"`),
  ])

  if (preferences) validatePreferences(preferences, input)
  if (home) validateHome(home, input.ownerId)

  const relevantWidgetFilter = `${ownerFilter} && ${relevantWidgetSeedKeyFilter}`
  const homeSeedWidgetsFilter = home ? `${relevantWidgetFilter} && dashboard = "${filterValue(home.id)}"` : relevantWidgetFilter
  const homeSeedWidgets = await input.pb.collection('dashboard_widgets').getFullList<SeedWidgetRecord>({ filter: homeSeedWidgetsFilter, requestKey: null })
  const wrongDashboardSeedWidget = home
    ? await findFirstOrNull<SeedWidgetRecord>(input.pb.collection('dashboard_widgets'), `${relevantWidgetFilter} && dashboard != "${filterValue(home.id)}"`)
    : null
  if (wrongDashboardSeedWidget) throw seedConflict()

  const widgetsBySeedKey = new Map<InitialWidgetType, SeedWidgetRecord>()
  for (const seedKey of requiredWidgetSeedKeys) {
    const matchingWidgets = homeSeedWidgets.filter((widget) => widget.seedKey === seedKey)
    if (matchingWidgets.length === 0) continue
    if (!home || matchingWidgets.length !== 1) throw seedConflict()
    const widget = matchingWidgets[0]
    if (!widget) throw seedConflict()
    validateSeedWidget(widget, input.ownerId, home.id, seedKey, input)
    widgetsBySeedKey.set(seedKey, widget)
  }

  return { preferences, home, widgetsBySeedKey }
}

const createMissingSeedRecords = async (input: InternalEnsureOnboardingHomeSeedInput, state: ExistingSeedState): Promise<{ readonly home: SeedDashboardRecord, readonly widgets: readonly SeedWidgetRecord[] }> => {
  if (!state.preferences) await createMissingPreferences(input)
  const home = state.home ?? await createMissingHome(input)
  const widgets: SeedWidgetRecord[] = []
  for (const seedKey of requiredWidgetSeedKeys) {
    widgets.push(state.widgetsBySeedKey.get(seedKey) ?? await createMissingSeedWidget(input, home.id, seedKey))
  }
  return { home, widgets }
}

const widgetIdsFromMap = (widgetsBySeedKey: ReadonlyMap<InitialWidgetType, SeedWidgetRecord>): Record<InitialWidgetType, string> => ({
  search: widgetsBySeedKey.get('search')?.id ?? '',
  clock: widgetsBySeedKey.get('clock')?.id ?? '',
  weather: widgetsBySeedKey.get('weather')?.id ?? '',
  bookmarks: widgetsBySeedKey.get('bookmarks')?.id ?? '',
})

const widgetIdsFromList = (widgets: readonly SeedWidgetRecord[]): Record<InitialWidgetType, string> => ({
  search: widgets.find((widget) => widget.seedKey === 'search')?.id ?? '',
  clock: widgets.find((widget) => widget.seedKey === 'clock')?.id ?? '',
  weather: widgets.find((widget) => widget.seedKey === 'weather')?.id ?? '',
  bookmarks: widgets.find((widget) => widget.seedKey === 'bookmarks')?.id ?? '',
})

const ensureOnboardingHomeSeedInternal = async (input: InternalEnsureOnboardingHomeSeedInput): Promise<EnsureOnboardingHomeSeedResult> => {
  const profile = await loadOwnerProfile(input)
  if (profile.onboardingCompleted === true) {
    const state = await loadExistingSeedState(input)
    if (!state.home || state.widgetsBySeedKey.size !== requiredWidgetSeedKeys.length || !state.preferences) throw seedConflict()
    return {
      status: 'already-complete',
      homeDashboardId: state.home.id,
      widgetIdsBySeedKey: widgetIdsFromMap(state.widgetsBySeedKey),
    }
  }

  const state = await loadExistingSeedState(input)
  const { home, widgets } = await createMissingSeedRecords(input, state)
  return {
    status: 'recovered',
    homeDashboardId: home.id,
    widgetIdsBySeedKey: widgetIdsFromList(widgets),
  }
}

export const ensureOnboardingHomeSeed = async (input: EnsureOnboardingHomeSeedInput): Promise<EnsureOnboardingHomeSeedResult> => await ensureOnboardingHomeSeedInternal(input)

const completedSessionFromProfile = (profile: RecordModel): SafeSessionDto & { readonly onboardingCompleted: true } => {
  if (profile.onboardingCompleted !== true) throw completionFailure()
  return {
    id: profile.id,
    displayName: optionalString(profile.displayName, 80),
    avatarKey: optionalString(profile.avatarKey, 80),
    onboardingCompleted: true,
  }
}

const injectFailureAt = (injection: FailureInjection | undefined, stage: DurableStage): void => {
  if (injection?.failAfterDurableStage === stage) throw completionFailure()
}

const pauseForRetry = async (attempt: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 5 + attempt * 5))
}

const finalizeOnboarding = async (input: CompleteOnboardingInput, injection: FailureInjection | undefined): Promise<void> => {
  const finalState = await loadExistingSeedState({ ...input, allowIncompletePlaceholderConfig: true })
  if (!finalState.preferences || !finalState.home || finalState.widgetsBySeedKey.size !== requiredWidgetSeedKeys.length) throw seedConflict()

  if (injection?.expireSessionBeforeFinalization) {
    input.pb.authStore.clear()
    throw new ApiError(401, 'unauthenticated', 'Authentication is required.')
  }

  if (injection?.mutateSeedBeforeFinalization) {
    const search = finalState.widgetsBySeedKey.get('search')
    if (!search) throw seedConflict()
    await mutableCollection(input, 'dashboard_widgets').update(search.id, { config: { engine: 'corrupt' } }, { requestKey: null })
    throw seedConflict()
  }

  if (injection?.deleteSeedBeforeFinalization) {
    const weather = finalState.widgetsBySeedKey.get('weather')
    if (!weather) throw seedConflict()
    await mutableCollection(input, 'dashboard_widgets').delete(weather.id, { requestKey: null })
    throw seedConflict()
  }

  const clock = finalState.widgetsBySeedKey.get('clock')
  const weather = finalState.widgetsBySeedKey.get('weather')
  if (!clock || !weather) throw seedConflict()

  const batch = input.pb.createBatch()
  batch.collection('user_preferences').update(finalState.preferences.id, { defaultLocation: input.defaultLocation })
  batch.collection('dashboard_widgets').update(clock.id, { config: { mode: 'local', timezone: input.timezone } })
  batch.collection('dashboard_widgets').update(weather.id, { config: { location: input.defaultLocation } })
  batch.collection('users').update(input.ownerId, {
    displayName: input.displayName,
    avatarKey: input.avatarKey,
    timezone: input.timezone,
    onboardingCompleted: true,
  })
  await batch.send()
}

const persistIncompleteProfile = async (input: CompleteOnboardingInput): Promise<RecordModel> => {
  const profile = await loadOwnerProfile(input)
  if (profile.onboardingCompleted === true) return profile
  return await mutableCollection(input, 'users').update(input.ownerId, {
    displayName: input.displayName,
    avatarKey: input.avatarKey,
    timezone: input.timezone,
    onboardingCompleted: false,
  }, { requestKey: null })
}

export const completeOnboarding = async (input: CompleteOnboardingInput): Promise<CompleteOnboardingResult> => {
  let transientFailureInjected = false

  for (let attempt = 0; attempt < maximumCompletionAttempts; attempt += 1) {
    try {
      const profile = await loadOwnerProfile(input)
      if (profile.onboardingCompleted === true) {
        return { status: 'already-complete', session: completedSessionFromProfile(profile) }
      }

      await persistIncompleteProfile(input)
      injectFailureAt(input.failureInjection, 'profile-draft')

      await ensureOnboardingHomeSeedInternal({
        pb: input.pb,
        ownerId: input.ownerId,
        timezone: input.timezone,
        defaultLocation: input.defaultLocation,
        allowIncompletePlaceholderConfig: true,
        onDurableStage: (stage) => injectFailureAt(input.failureInjection, stage),
      })
      if (input.failureInjection?.forceTransientBusy && (input.failureInjection.forceTransientBusy === 'always' || !transientFailureInjected)) {
        transientFailureInjected = true
        throw new OnboardingCompletionError('onboarding_busy', 'Onboarding is temporarily busy. Please retry.', true, 503)
      }

      await finalizeOnboarding(input, input.failureInjection)
      const completed = await loadOwnerProfile(input)
      if (completed.onboardingCompleted !== true) throw completionFailure()

      if (input.failureInjection?.loseSuccessResponse) {
        throw new OnboardingCompletionError('response_lost', 'The completion response was lost. Please refresh.', true, 503)
      }

      return { status: 'completed', session: completedSessionFromProfile(completed) }
    } catch (error) {
      if (error instanceof OnboardingCompletionError && error.code === 'response_lost') throw error
      if (error instanceof ApiError && error.code === 'unauthenticated') throw error

      if (error instanceof OnboardingCompletionError && ['seed_conflict', 'onboarding_completion_failed'].includes(error.code)) {
        const profile = await loadOwnerProfile(input)
        if (profile.onboardingCompleted === true) {
          return { status: 'already-complete', session: completedSessionFromProfile(profile) }
        }
        throw error
      }

      const retryable = error instanceof OnboardingCompletionError
        ? error.retryable
        : isRecoverablePocketBaseError(error)

      if (retryable) {
        const profile = await loadOwnerProfile(input)
        if (profile.onboardingCompleted === true) {
          return { status: 'already-complete', session: completedSessionFromProfile(profile) }
        }

        if (attempt + 1 >= maximumCompletionAttempts) {
          throw retryExhausted()
        }

        await pauseForRetry(attempt)
        continue
      }

      throw toOnboardingApiError(error)
    }
  }

  throw completionFailure()
}

export const loadOnboardingDraft = async (dependencies: OnboardingDraftDependencies): Promise<OnboardingDraftEnvelope> => {
  const { session } = await resolveSession(dependencies)
  if (!session) throw new ApiError(401, 'unauthenticated', 'Authentication is required.')
  if (session.onboardingCompleted) throw new ApiError(409, 'onboarding_already_completed', 'Onboarding has already been completed.')

  const [profile, preferences] = await Promise.all([userProfile(dependencies, session.id), preferencesForOwner(dependencies, session.id)])
  if (profile.onboardingCompleted === true) throw new ApiError(409, 'onboarding_already_completed', 'Onboarding has already been completed.')
  return {
    draft: {
      displayName: optionalString(profile.displayName, 80),
      avatarKey: optionalString(profile.avatarKey, 80),
      timezone: optionalString(profile.timezone, 100),
      defaultLocation: draftLocation(preferences),
    },
  }
}
