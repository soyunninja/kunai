import { describe, expect, it } from 'vitest'

import type {
  DashboardArchivePolicyInput,
  DashboardReorderContext,
  DashboardState,
} from '../../shared/types/dashboard'
import {
  assertDashboardCanBeArchived,
  parseActiveDashboardInput,
  parseArchiveDashboardInput,
  parseCreateDashboardInput,
  parseDashboardName,
  parseRenameDashboardInput,
  parseReorderDashboardInput,
  projectDashboardTab,
  resolveActiveDashboard,
  validateDashboardReorder,
} from '../../shared/validation/dashboard'

const ownerA = 'owner-a'
const ownerB = 'owner-b'

const dashboard = (
  id: string,
  overrides: Partial<DashboardState> = {},
): DashboardState => ({
  id,
  ownerId: ownerA,
  name: id,
  sortOrder: 0,
  seedKey: null,
  archivedAt: null,
  createdAt: `2026-09-15T00:00:0${id.length}Z`,
  ...overrides,
})

const home = dashboard('home', { name: 'Home', seedKey: 'home', sortOrder: 0 })
const work = dashboard('work', { name: 'Work', sortOrder: 1 })
const archived = dashboard('archived', { archivedAt: '2026-09-15T12:00:00Z', sortOrder: 2 })
const foreign = dashboard('foreign', { ownerId: ownerB, sortOrder: 0 })

const activeResolutionInput = (overrides: Partial<DashboardReorderContext> & {
  readonly requestedDashboardId?: string | null
  readonly persistedActiveDashboardId?: string | null
} = {}) => ({
  ownerId: ownerA,
  dashboards: [home, work, archived, foreign],
  ...overrides,
})

const reorderContext: DashboardReorderContext = {
  ownerId: ownerA,
  dashboards: [home, work, archived, foreign],
}

describe('dashboard shell DTO projection', () => {
  it('exposes only safe tab fields and derives Home without leaking persistence data', () => {
    const dto = projectDashboardTab(home)

    expect(dto).toEqual({
      id: 'home',
      name: 'Home',
      sortOrder: 0,
      isHome: true,
    })
    expect(Object.keys(dto).sort()).toEqual(['id', 'isHome', 'name', 'sortOrder'])
    expect(dto).not.toHaveProperty('ownerId')
    expect(dto).not.toHaveProperty('seedKey')
    expect(dto).not.toHaveProperty('archivedAt')
    expect(dto).not.toHaveProperty('createdAt')
    expect(dto).not.toHaveProperty('widgets')
    expect(dto).not.toHaveProperty('layout')
  })

  it('does not infer Home from the user-controlled name', () => {
    expect(projectDashboardTab(dashboard('renamed-home', {
      name: 'Start here',
      seedKey: 'home',
    }))).toMatchObject({ isHome: true })
    expect(projectDashboardTab(dashboard('named-home', { name: 'Home' }))).toMatchObject({ isHome: false })
  })
})

describe('dashboard name and mutation payload parsing', () => {
  it('trims a required bounded dashboard name without imposing slug rules', () => {
    expect(parseDashboardName('  Travel  ')).toBe('Travel')
    expect(parseDashboardName('Plan 2026 / España!')).toBe('Plan 2026 / España!')
    expect(parseDashboardName('a'.repeat(80))).toHaveLength(80)
  })

  it('rejects empty, whitespace-only, overlong, and non-string dashboard names without coercion', () => {
    expect(() => parseDashboardName('')).toThrow(/dashboard name/i)
    expect(() => parseDashboardName('   ')).toThrow(/dashboard name/i)
    expect(() => parseDashboardName('a'.repeat(81))).toThrow(/80/i)
    expect(() => parseDashboardName(42)).toThrow(/dashboard name/i)
    expect(() => parseDashboardName({ toString: () => 'coerced' })).toThrow(/dashboard name/i)
  })

  it('accepts create payloads containing only a validated name', () => {
    expect(parseCreateDashboardInput({ name: '  Travel  ' })).toEqual({ name: 'Travel' })
  })

  it('uses the path id rather than a rename body id and still permits Home renames', () => {
    expect(parseRenameDashboardInput({ name: '  Start here  ' })).toEqual({ name: 'Start here' })
    expect(() => parseRenameDashboardInput({ id: home.id, name: 'Start here' })).toThrow(/unknown/i)
  })

  it('rejects unknown fields in every dashboard mutation payload', () => {
    expect(() => parseCreateDashboardInput({ name: 'Travel', owner: ownerB })).toThrow(/unknown/i)
    expect(() => parseCreateDashboardInput({ name: 'Travel', seedKey: 'home' })).toThrow(/unknown/i)
    expect(() => parseCreateDashboardInput({ name: 'Travel', archivedAt: '2026-09-15T12:00:00Z' })).toThrow(/unknown/i)
    expect(() => parseCreateDashboardInput({ name: 'Travel', sortOrder: 99 })).toThrow(/unknown/i)
    expect(() => parseRenameDashboardInput({ name: 'Travel', owner: ownerB })).toThrow(/unknown/i)
    expect(() => parseActiveDashboardInput({ dashboardId: work.id, owner: ownerB })).toThrow(/unknown/i)
    expect(() => parseReorderDashboardInput({ dashboardIds: [home.id, work.id], archivedAt: null })).toThrow(/unknown/i)
    expect(() => parseArchiveDashboardInput({ force: true })).toThrow(/unknown/i)
  })

  it('rejects malformed mutation payloads instead of silently coercing them', () => {
    expect(() => parseCreateDashboardInput(null)).toThrow(/object/i)
    expect(() => parseRenameDashboardInput({ name: ['Travel'] })).toThrow(/name/i)
    expect(() => parseActiveDashboardInput({ dashboardId: 1 })).toThrow(/dashboardId/i)
    expect(() => parseReorderDashboardInput({ dashboardIds: 'work' })).toThrow(/dashboardIds/i)
    expect(() => parseArchiveDashboardInput([])).toThrow(/object/i)
  })
})

describe('active dashboard resolution', () => {
  it('selects a valid persisted active dashboard without writing state', () => {
    const input = activeResolutionInput({ persistedActiveDashboardId: work.id })
    const originalPreference = input.persistedActiveDashboardId

    expect(resolveActiveDashboard(input)).toMatchObject({ id: work.id })
    expect(input.persistedActiveDashboardId).toBe(originalPreference)
  })

  it('falls back deterministically by persisted order without preferring Home specially', () => {
    expect(resolveActiveDashboard(activeResolutionInput({
      dashboards: [
        dashboard('work-first', { name: 'Work', sortOrder: 0 }),
        dashboard('home-second', { name: 'Home', seedKey: 'home', sortOrder: 1 }),
        archived,
        foreign,
      ],
      persistedActiveDashboardId: null,
    }))).toMatchObject({ id: 'work-first' })
    expect(resolveActiveDashboard(activeResolutionInput({
      dashboards: [
        dashboard('work-second', { name: 'Work', sortOrder: 1 }),
        dashboard('home-first', { name: 'Home', seedKey: 'home', sortOrder: 0 }),
      ],
    }))).toMatchObject({ id: 'home-first' })
  })

  it('never selects archived or cross-owner dashboards as fallback candidates', () => {
    expect(resolveActiveDashboard(activeResolutionInput({
      dashboards: [
        foreign,
        archived,
        work,
      ],
      requestedDashboardId: archived.id,
      persistedActiveDashboardId: foreign.id,
    }))).toMatchObject({ id: work.id })
  })

  it('ignores requested or persisted dashboards that are archived, missing, or owned by another user', () => {
    expect(resolveActiveDashboard(activeResolutionInput({ requestedDashboardId: archived.id }))).toMatchObject({ id: home.id })
    expect(resolveActiveDashboard(activeResolutionInput({ requestedDashboardId: foreign.id }))).toMatchObject({ id: home.id })
    expect(resolveActiveDashboard(activeResolutionInput({ requestedDashboardId: 'missing' }))).toMatchObject({ id: home.id })
    expect(resolveActiveDashboard(activeResolutionInput({ persistedActiveDashboardId: archived.id }))).toMatchObject({ id: home.id })
    expect(resolveActiveDashboard(activeResolutionInput({ persistedActiveDashboardId: foreign.id }))).toMatchObject({ id: home.id })
  })

  it('uses a valid request selection ahead of a valid persisted selection and returns no persistence capability', () => {
    const resolved = resolveActiveDashboard(activeResolutionInput({
      requestedDashboardId: work.id,
      persistedActiveDashboardId: home.id,
    }))

    expect(resolved).toMatchObject({ id: work.id })
    expect(resolved).not.toHaveProperty('ownerId')
    expect(resolved).not.toHaveProperty('write')
  })
})

describe('dashboard reorder validation', () => {
  it('accepts only the complete current non-archived owner-scoped dashboard set and creates a deterministic pure plan', () => {
    const originalOrders = reorderContext.dashboards.map(({ id, sortOrder }) => ({ id, sortOrder }))

    expect(validateDashboardReorder({ dashboardIds: [work.id, home.id] }, reorderContext)).toEqual({
      dashboardIds: [work.id, home.id],
      sortOrderByDashboardId: { work: 0, home: 1 },
    })
    expect(reorderContext.dashboards.map(({ id, sortOrder }) => ({ id, sortOrder }))).toEqual(originalOrders)
  })

  it('rejects missing, duplicate, archived, foreign, and nonexistent dashboard ids', () => {
    expect(() => validateDashboardReorder({ dashboardIds: [home.id] }, reorderContext)).toThrow(/complete|missing/i)
    expect(() => validateDashboardReorder({ dashboardIds: [home.id, home.id] }, reorderContext)).toThrow(/duplicate/i)
    expect(() => validateDashboardReorder({ dashboardIds: [home.id, archived.id, work.id] }, reorderContext)).toThrow(/archived/i)
    expect(() => validateDashboardReorder({ dashboardIds: [home.id, foreign.id, work.id] }, reorderContext)).toThrow(/owner|foreign/i)
    expect(() => validateDashboardReorder({ dashboardIds: [home.id, work.id, 'missing'] }, reorderContext)).toThrow(/missing|unknown/i)
  })
})

describe('dashboard archive policy', () => {
  const archiveInput = (overrides: Partial<DashboardArchivePolicyInput> = {}): DashboardArchivePolicyInput => ({
    ownerId: ownerA,
    dashboardId: work.id,
    activeDashboardId: home.id,
    dashboards: [home, work, archived, foreign],
    ...overrides,
  })

  it('allows archiving an owned inactive non-Home dashboard when another active dashboard remains', () => {
    expect(assertDashboardCanBeArchived(archiveInput())).toEqual({
      dashboardId: work.id,
      requiresActiveDashboardChange: false,
      fallbackActiveDashboardId: null,
    })
  })

  it('plans active-dashboard fallback before archiving the current active dashboard', () => {
    expect(assertDashboardCanBeArchived(archiveInput({
      dashboardId: work.id,
      activeDashboardId: work.id,
      dashboards: [
        dashboard('later', { sortOrder: 2 }),
        dashboard('first-remaining', { sortOrder: 0 }),
        work,
        archived,
        foreign,
      ],
    }))).toEqual({
      dashboardId: work.id,
      requiresActiveDashboardChange: true,
      fallbackActiveDashboardId: 'first-remaining',
    })
  })

  it('never plans an archived or cross-owner fallback for active dashboard archive', () => {
    expect(assertDashboardCanBeArchived(archiveInput({
      dashboardId: work.id,
      activeDashboardId: work.id,
      dashboards: [foreign, archived, home, work],
    }))).toEqual({
      dashboardId: work.id,
      requiresActiveDashboardChange: true,
      fallbackActiveDashboardId: home.id,
    })
  })

  it('rejects Home, last-active, already archived, foreign, and nonexistent archive targets', () => {
    expect(() => assertDashboardCanBeArchived(archiveInput({ dashboardId: home.id }))).toThrow(/home/i)
    expect(() => assertDashboardCanBeArchived(archiveInput({
      dashboardId: work.id,
      activeDashboardId: work.id,
      dashboards: [work],
    }))).toThrow(/last/i)
    expect(() => assertDashboardCanBeArchived(archiveInput({ dashboardId: archived.id }))).toThrow(/archived/i)
    expect(() => assertDashboardCanBeArchived(archiveInput({ dashboardId: foreign.id }))).toThrow(/owner|foreign/i)
    expect(() => assertDashboardCanBeArchived(archiveInput({ dashboardId: 'missing' }))).toThrow(/missing|unknown/i)
  })
})
