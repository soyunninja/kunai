import type {
  DashboardArchiveDecision,
  DashboardArchivePolicyInput,
  DashboardReorderPlan,
  DashboardShellDto,
  DashboardState,
  DashboardTabDto,
  ResolveActiveDashboardInput,
} from '../../shared/types/dashboard'
import {
  assertDashboardCanBeArchived,
  projectDashboardTab,
  resolveActiveDashboard,
  validateDashboardReorder,
} from '../../shared/validation/dashboard'

export interface DashboardListOptions {
  readonly filter: string
  readonly sort: string
}

/**
 * Narrow request-scoped normal-user PocketBase surface required for dashboard
 * reads. Routes inject their authenticated client; this utility creates none.
 */
export interface DashboardPocketBaseLike {
  readonly collection: (name: 'dashboards') => {
    readonly getFullList: (options: DashboardListOptions) => Promise<readonly unknown[]>
  }
}

const isRecordObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const requiredString = (record: Record<string, unknown>, field: string): string => {
  const value = record[field]
  if (typeof value !== 'string') {
    throw new Error(`Dashboard record has an invalid ${field} field.`)
  }

  return value
}

const requiredFiniteNumber = (record: Record<string, unknown>, field: string): number => {
  const value = record[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Dashboard record has an invalid ${field} field.`)
  }

  return value
}

const nullableString = (value: unknown): string | null => (
  typeof value === 'string' && value.length > 0 ? value : null
)

const dashboardOrder = (left: DashboardState, right: DashboardState): number => (
  left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
)

const filterValue = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

export const mapDashboardRecord = (record: unknown): DashboardState => {
  if (!isRecordObject(record)) {
    throw new Error('Dashboard record must be an object.')
  }

  return {
    id: requiredString(record, 'id'),
    ownerId: requiredString(record, 'owner'),
    name: requiredString(record, 'name'),
    sortOrder: requiredFiniteNumber(record, 'sortOrder'),
    seedKey: nullableString(record.seedKey),
    archivedAt: nullableString(record.archivedAt),
  }
}

export const loadOwnerDashboards = async (
  client: DashboardPocketBaseLike,
  ownerId: string,
): Promise<readonly DashboardState[]> => {
  const records = await client.collection('dashboards').getFullList({
    filter: `owner = "${filterValue(ownerId)}" && archivedAt = ""`,
    sort: '+sortOrder,+id',
  })

  return records
    .map(mapDashboardRecord)
    .filter((dashboard) => dashboard.ownerId === ownerId && dashboard.archivedAt === null)
    .sort(dashboardOrder)
}

export const projectDashboardTabs = (
  dashboards: readonly DashboardState[],
): readonly DashboardTabDto[] => dashboards.map(projectDashboardTab)

export const projectDashboardShell = (
  dashboards: readonly DashboardState[],
  activeDashboard: DashboardTabDto,
): DashboardShellDto => ({
  dashboards: projectDashboardTabs(dashboards),
  activeDashboardId: activeDashboard.id,
  activeDashboard,
})

export const loadOwnerDashboardShell = async (
  client: DashboardPocketBaseLike,
  input: Omit<ResolveActiveDashboardInput, 'dashboards'>,
): Promise<DashboardShellDto> => {
  const dashboards = await loadOwnerDashboards(client, input.ownerId)
  const activeDashboard = resolveActiveDashboard({ ...input, dashboards })

  return projectDashboardShell(dashboards, activeDashboard)
}

export const validateOwnerDashboardReorder = (
  input: unknown,
  ownerId: string,
  dashboards: readonly DashboardState[],
): DashboardReorderPlan => validateDashboardReorder(input, { ownerId, dashboards })

export const validateOwnerDashboardArchive = (
  input: DashboardArchivePolicyInput,
): DashboardArchiveDecision => assertDashboardCanBeArchived(input)
