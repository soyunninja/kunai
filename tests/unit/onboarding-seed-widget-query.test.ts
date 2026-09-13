import { describe, expect, it } from 'vitest'

import { ensureOnboardingHomeSeed } from '../../server/utils/onboarding'
import { createInitialWidgetConfig, type InitialWidgetType } from '../../shared/validation/onboarding'

type SeedInput = Parameters<typeof ensureOnboardingHomeSeed>[0]
type SeedPb = SeedInput['pb']

interface FakeRecord {
  readonly id: string
  readonly owner: string
  readonly [key: string]: unknown
}

interface FakeWidget extends FakeRecord {
  readonly dashboard: string
  readonly type: string
  readonly seedKey: string
  readonly config: unknown
  readonly layoutDesktop: null
  readonly layoutTablet: null
  readonly layoutMobile: null
}

const ownerId = 'owner_123'
const homeId = 'home_123'
const timezone = 'Europe/Madrid'
const relevantSeedKeys = ['search', 'clock', 'weather', 'bookmarks'] as const
const relevantSeedKeyFilter = '(seedKey = "search" || seedKey = "clock" || seedKey = "weather" || seedKey = "bookmarks")'
const homeWidgetFilter = `owner = "${ownerId}" && ${relevantSeedKeyFilter} && dashboard = "${homeId}"`
const wrongDashboardFilter = `owner = "${ownerId}" && ${relevantSeedKeyFilter} && dashboard != "${homeId}"`

const notFound = () => Object.assign(new Error('not found'), { status: 404 })

const seedConfig = (seedKey: InitialWidgetType): unknown => {
  if (seedKey === 'clock') return createInitialWidgetConfig('clock', { timezone })
  if (seedKey === 'weather') return createInitialWidgetConfig('weather', { defaultLocation: null })
  if (seedKey === 'search') return createInitialWidgetConfig('search')
  return createInitialWidgetConfig('bookmarks')
}

const seedWidget = (seedKey: InitialWidgetType, overrides: Partial<FakeWidget> = {}): FakeWidget => ({
  id: `${seedKey}_widget`,
  owner: ownerId,
  dashboard: homeId,
  type: seedKey,
  seedKey,
  config: seedConfig(seedKey),
  layoutDesktop: null,
  layoutTablet: null,
  layoutMobile: null,
  ...overrides,
})

const completeSeedWidgets = () => relevantSeedKeys.map((seedKey) => seedWidget(seedKey))

const createFakePb = (input: {
  readonly widgets: readonly FakeWidget[]
  readonly wrongDashboardSeed?: FakeWidget
  readonly widgetFilters: string[]
}): SeedPb => {
  const profile = { id: ownerId, owner: ownerId, onboardingCompleted: false }
  const preferences = { id: 'preferences_123', owner: ownerId, defaultLocation: null }
  const home = { id: homeId, owner: ownerId, name: 'Home', sortOrder: 0, seedKey: 'home' }

  return {
    collection(name: string) {
      return {
        async getOne<T = FakeRecord>(id: string): Promise<T> {
          if (name === 'users' && id === ownerId) return profile as T
          throw notFound()
        },
        async getFirstListItem<T = FakeRecord>(filter: string): Promise<T> {
          if (name === 'user_preferences' && filter === `owner = "${ownerId}"`) return preferences as T
          if (name === 'dashboards' && filter === `owner = "${ownerId}" && seedKey = "home"`) return home as T
          if (name === 'dashboard_widgets' && filter === wrongDashboardFilter) {
            if (input.wrongDashboardSeed) return input.wrongDashboardSeed as T
            throw notFound()
          }
          throw new Error(`unexpected getFirstListItem ${name}: ${filter}`)
        },
        async getFullList<T = FakeRecord>(options?: Record<string, unknown>): Promise<T[]> {
          const filter = options?.filter
          if (name !== 'dashboard_widgets') throw new Error(`unexpected getFullList collection ${name}`)
          if (typeof filter === 'string') input.widgetFilters.push(filter)
          if (filter !== homeWidgetFilter) throw new Error(`unexpected dashboard_widgets scan: ${String(filter)}`)
          return input.widgets as T[]
        },
        async create<T = FakeRecord>(): Promise<T> {
          throw new Error(`unexpected create ${name}`)
        },
      }
    },
  }
}

describe('onboarding seed widget query bounds', () => {
  it('loads only Home seed widgets by owner, relevant seedKey, and Home dashboard', async () => {
    const widgetFilters: string[] = []
    const result = await ensureOnboardingHomeSeed({
      pb: createFakePb({
        widgets: completeSeedWidgets(),
        widgetFilters,
      }),
      ownerId,
      timezone,
      defaultLocation: null,
    })

    expect(widgetFilters).toEqual([homeWidgetFilter])
    expect(result.widgetIdsBySeedKey).toEqual({
      search: 'search_widget',
      clock: 'clock_widget',
      weather: 'weather_widget',
      bookmarks: 'bookmarks_widget',
    })
  })

  it('does not load or process unrelated custom widgets', async () => {
    const widgetFilters: string[] = []
    const customWidget = seedWidget('search', {
      id: 'custom_widget',
      dashboard: 'custom_dashboard',
      seedKey: '',
      config: { engine: 'custom' },
    })

    await expect(ensureOnboardingHomeSeed({
      pb: createFakePb({
        widgets: completeSeedWidgets(),
        widgetFilters,
      }),
      ownerId,
      timezone,
      defaultLocation: null,
    })).resolves.toMatchObject({ status: 'recovered' })
    expect(widgetFilters).toEqual([homeWidgetFilter])
    expect(widgetFilters.join('\n')).not.toContain(customWidget.id)
    expect(widgetFilters.join('\n')).not.toContain('seedKey = ""')
  })

  it('still rejects corrupt relevant seed widgets', async () => {
    const widgetFilters: string[] = []
    await expect(ensureOnboardingHomeSeed({
      pb: createFakePb({
        widgets: completeSeedWidgets().map((widget) => widget.seedKey === 'search' ? { ...widget, config: { engine: 'custom-provider' } } : widget),
        widgetFilters,
      }),
      ownerId,
      timezone,
      defaultLocation: null,
    })).rejects.toMatchObject({ code: 'seed_conflict' })
    expect(widgetFilters).toEqual([homeWidgetFilter])
  })

  it('still rejects relevant seed widgets attached to a non-Home dashboard', async () => {
    const widgetFilters: string[] = []
    await expect(ensureOnboardingHomeSeed({
      pb: createFakePb({
        widgets: completeSeedWidgets(),
        wrongDashboardSeed: seedWidget('search', { id: 'wrong_dashboard_search', dashboard: 'custom_dashboard' }),
        widgetFilters,
      }),
      ownerId,
      timezone,
      defaultLocation: null,
    })).rejects.toMatchObject({ code: 'seed_conflict' })
    expect(widgetFilters).toEqual([homeWidgetFilter])
  })
})
