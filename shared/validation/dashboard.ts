import type {
  DashboardActiveSelectionInput,
  DashboardArchiveDecision,
  DashboardArchiveInput,
  DashboardArchivePolicyInput,
  DashboardCreateInput,
  DashboardReorderContext,
  DashboardReorderInput,
  DashboardReorderPlan,
  DashboardRenameInput,
  DashboardState,
  DashboardTabDto,
  ResolveActiveDashboardInput,
} from '../types/dashboard'

export class DashboardValidationError extends Error {
  readonly code = 'invalid_dashboard_input'

  constructor(message: string) {
    super(message)
    this.name = 'DashboardValidationError'
  }
}

const maximumDashboardNameLength = 80

const isRecordObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const requirePayloadObject = (value: unknown): Record<string, unknown> => {
  if (!isRecordObject(value)) {
    throw new DashboardValidationError('Dashboard payload must be an object.')
  }

  return value
}

const assertOnlyFields = (
  payload: Record<string, unknown>,
  allowedFields: readonly string[],
): void => {
  if (Object.keys(payload).some((field) => !allowedFields.includes(field))) {
    throw new DashboardValidationError('Dashboard payload contains unknown fields.')
  }
}

const activeOwnerDashboards = (
  dashboards: readonly DashboardState[],
  ownerId: string,
): DashboardState[] => dashboards.filter((dashboard) => (
  dashboard.ownerId === ownerId && dashboard.archivedAt === null
))

const dashboardOrder = (left: DashboardState, right: DashboardState): number => (
  left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
)

const findActiveDashboard = (
  dashboards: readonly DashboardState[],
  dashboardId: string | null | undefined,
): DashboardState | undefined => (
  typeof dashboardId === 'string'
    ? dashboards.find((dashboard) => dashboard.id === dashboardId)
    : undefined
)

export const parseDashboardName = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new DashboardValidationError('Dashboard name must be a string.')
  }

  const name = value.trim()
  if (name.length === 0) {
    throw new DashboardValidationError('Dashboard name cannot be empty.')
  }

  if (name.length > maximumDashboardNameLength) {
    throw new DashboardValidationError(`Dashboard name must be at most ${maximumDashboardNameLength} characters.`)
  }

  return name
}

export const parseCreateDashboardInput = (input: unknown): DashboardCreateInput => {
  const payload = requirePayloadObject(input)
  assertOnlyFields(payload, ['name'])

  return { name: parseDashboardName(payload.name) }
}

export const parseRenameDashboardInput = (input: unknown): DashboardRenameInput => {
  const payload = requirePayloadObject(input)
  assertOnlyFields(payload, ['name'])

  return { name: parseDashboardName(payload.name) }
}

export const parseActiveDashboardInput = (input: unknown): DashboardActiveSelectionInput => {
  const payload = requirePayloadObject(input)
  assertOnlyFields(payload, ['dashboardId'])

  if (typeof payload.dashboardId !== 'string' || payload.dashboardId.length === 0) {
    throw new DashboardValidationError('dashboardId must be a non-empty string.')
  }

  return { dashboardId: payload.dashboardId }
}

export const parseReorderDashboardInput = (input: unknown): DashboardReorderInput => {
  const payload = requirePayloadObject(input)
  assertOnlyFields(payload, ['dashboardIds'])

  if (!Array.isArray(payload.dashboardIds) || !payload.dashboardIds.every((id) => typeof id === 'string')) {
    throw new DashboardValidationError('dashboardIds must be an array of strings.')
  }

  return { dashboardIds: [...payload.dashboardIds] }
}

export const parseArchiveDashboardInput = (input: unknown): DashboardArchiveInput => {
  const payload = requirePayloadObject(input)
  assertOnlyFields(payload, [])

  return Object.freeze({})
}

export const projectDashboardTab = (dashboard: DashboardState): DashboardTabDto => ({
  id: dashboard.id,
  name: dashboard.name,
  sortOrder: dashboard.sortOrder,
  isHome: dashboard.seedKey === 'home',
})

export const resolveActiveDashboard = (input: ResolveActiveDashboardInput): DashboardTabDto => {
  const dashboards = activeOwnerDashboards(input.dashboards, input.ownerId)
  const requestedDashboard = findActiveDashboard(dashboards, input.requestedDashboardId)
  const persistedDashboard = findActiveDashboard(dashboards, input.persistedActiveDashboardId)
  const fallbackDashboard = [...dashboards].sort(dashboardOrder)[0]
  const selectedDashboard = requestedDashboard ?? persistedDashboard ?? fallbackDashboard

  if (!selectedDashboard) {
    throw new DashboardValidationError('No active dashboards are available.')
  }

  return projectDashboardTab(selectedDashboard)
}

export const validateDashboardReorder = (
  input: unknown,
  context: DashboardReorderContext,
): DashboardReorderPlan => {
  const { dashboardIds } = parseReorderDashboardInput(input)
  const seenDashboardIds = new Set<string>()

  for (const dashboardId of dashboardIds) {
    if (seenDashboardIds.has(dashboardId)) {
      throw new DashboardValidationError('Dashboard reorder payload contains duplicate dashboard ids.')
    }
    seenDashboardIds.add(dashboardId)

    const dashboard = context.dashboards.find((candidate) => candidate.id === dashboardId)
    if (!dashboard) {
      throw new DashboardValidationError('Dashboard reorder payload contains a missing dashboard id.')
    }
    if (dashboard.ownerId !== context.ownerId) {
      throw new DashboardValidationError('Dashboard reorder payload contains a foreign owner dashboard id.')
    }
    if (dashboard.archivedAt !== null) {
      throw new DashboardValidationError('Dashboard reorder payload contains an archived dashboard id.')
    }
  }

  const ownerDashboardIds = activeOwnerDashboards(context.dashboards, context.ownerId)
    .map((dashboard) => dashboard.id)
  if (dashboardIds.length !== ownerDashboardIds.length || ownerDashboardIds.some((id) => !seenDashboardIds.has(id))) {
    throw new DashboardValidationError('Dashboard reorder payload must contain the complete active dashboard set.')
  }

  return {
    dashboardIds: [...dashboardIds],
    sortOrderByDashboardId: Object.fromEntries(dashboardIds.map((id, index) => [id, index])),
  }
}

export const assertDashboardCanBeArchived = (
  input: DashboardArchivePolicyInput,
): DashboardArchiveDecision => {
  const target = input.dashboards.find((dashboard) => dashboard.id === input.dashboardId)
  if (!target) {
    throw new DashboardValidationError('Dashboard archive target is missing or unknown.')
  }
  if (target.ownerId !== input.ownerId) {
    throw new DashboardValidationError('Dashboard archive target belongs to a foreign owner.')
  }
  if (target.archivedAt !== null) {
    throw new DashboardValidationError('Dashboard archive target is already archived.')
  }
  if (target.seedKey === 'home') {
    throw new DashboardValidationError('Home dashboard cannot be archived.')
  }
  const remainingDashboards = activeOwnerDashboards(input.dashboards, input.ownerId)
    .filter((dashboard) => dashboard.id !== target.id)
    .sort(dashboardOrder)
  if (remainingDashboards.length === 0) {
    throw new DashboardValidationError('The last active dashboard cannot be archived.')
  }

  const requiresActiveDashboardChange = target.id === input.activeDashboardId

  return {
    dashboardId: target.id,
    requiresActiveDashboardChange,
    fallbackActiveDashboardId: requiresActiveDashboardChange ? remainingDashboards[0]?.id ?? null : null,
  }
}
