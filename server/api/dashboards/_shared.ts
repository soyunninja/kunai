import { getHeader, getQuery, getRouterParam, readBody, setResponseHeader, setResponseStatus, type H3Event } from 'h3'

import type { DashboardShellDto, DashboardState } from '../../../shared/types/dashboard'
import {
  DashboardValidationError,
  parseActiveDashboardInput,
  parseArchiveDashboardInput,
  parseCreateDashboardInput,
  parseRenameDashboardInput,
  resolveActiveDashboard,
} from '../../../shared/validation/dashboard'
import { apiErrorBody, ApiError } from '../../utils/api-error'
import { h3CookieController, h3HeaderReader } from '../../utils/h3-adapters'
import { getRequestPocketBase } from '../../utils/pocketbase-client'
import { getRuntimeConfig } from '../../utils/runtime-config'
import { resolveSession } from '../../utils/session'
import { validateSameOrigin } from '../../utils/same-origin'
import {
  loadOwnerDashboards,
  mapDashboardRecord,
  projectDashboardShell,
  validateOwnerDashboardArchive,
  validateOwnerDashboardReorder,
  type DashboardListOptions,
} from '../../utils/dashboards'

interface DashboardCollection {
  readonly getFullList: (options: DashboardListOptions) => Promise<readonly unknown[]>
  readonly create: (payload: Record<string, unknown>) => Promise<unknown>
  readonly update: (id: string, payload: Record<string, unknown>) => Promise<unknown>
}

interface PreferencesCollection {
  readonly getFirstListItem: (filter: string, options?: Record<string, unknown>) => Promise<unknown>
  readonly create: (payload: Record<string, unknown>) => Promise<unknown>
  readonly update: (id: string, payload: Record<string, unknown>) => Promise<unknown>
}

interface DashboardPocketBase {
  readonly collection: {
    (name: 'dashboards'): DashboardCollection
    (name: 'user_preferences'): PreferencesCollection
  }
}

interface PreferencesState {
  readonly id: string | null
  readonly activeDashboardId: string | null
}

interface DashboardRequestContext {
  readonly event: H3Event
  readonly pb: DashboardPocketBase
  readonly ownerId: string
}

const filterValue = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const hasStatus = (error: unknown, status: number): boolean => (
  typeof error === 'object'
  && error !== null
  && 'status' in error
  && error.status === status
)

const isRecordObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const asDashboardCollection = (pb: DashboardPocketBase): DashboardCollection => pb.collection('dashboards')

const asPreferencesCollection = (pb: DashboardPocketBase): PreferencesCollection => pb.collection('user_preferences')

const dashboardOrder = (left: DashboardState, right: DashboardState): number => (
  left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
)

const ownerDashboards = async (pb: DashboardPocketBase, ownerId: string): Promise<readonly DashboardState[]> => {
  const records = await asDashboardCollection(pb).getFullList({
    filter: `owner = "${filterValue(ownerId)}"`,
    sort: '+sortOrder,+id',
  })

  return records
    .map(mapDashboardRecord)
    .filter((dashboard) => dashboard.ownerId === ownerId)
    .sort(dashboardOrder)
}

const loadPreferences = async (pb: DashboardPocketBase, ownerId: string): Promise<PreferencesState> => {
  try {
    const record = await asPreferencesCollection(pb).getFirstListItem(`owner = "${filterValue(ownerId)}"`, { requestKey: null })
    if (!isRecordObject(record)) return { id: null, activeDashboardId: null }

    return {
      id: typeof record.id === 'string' ? record.id : null,
      activeDashboardId: typeof record.activeDashboard === 'string' && record.activeDashboard.length > 0
        ? record.activeDashboard
        : null,
    }
  } catch (error) {
    if (hasStatus(error, 404)) return { id: null, activeDashboardId: null }
    throw error
  }
}

const persistActiveDashboard = async (
  pb: DashboardPocketBase,
  ownerId: string,
  activeDashboardId: string,
): Promise<void> => {
  const preferences = await loadPreferences(pb, ownerId)
  if (preferences.id) {
    await asPreferencesCollection(pb).update(preferences.id, { activeDashboard: activeDashboardId })
    return
  }

  await asPreferencesCollection(pb).create({ owner: ownerId, activeDashboard: activeDashboardId })
}

const shellFor = async (
  pb: DashboardPocketBase,
  ownerId: string,
  requestedDashboardId?: string | null,
): Promise<DashboardShellDto> => {
  const preferences = await loadPreferences(pb, ownerId)
  const dashboards = await loadOwnerDashboards(pb, ownerId)
  const activeDashboard = resolveActiveDashboard({
    ownerId,
    dashboards,
    requestedDashboardId,
    persistedActiveDashboardId: preferences.activeDashboardId,
  })

  return projectDashboardShell(dashboards, activeDashboard)
}

const assertJsonRequest = (event: H3Event): void => {
  const contentType = (getHeader(event, 'content-type') ?? '').toLowerCase()
  if (!contentType.includes('application/json')) {
    throw new ApiError(415, 'unsupported_media_type', 'Expected application/json.')
  }
}

const requireDashboardId = (event: H3Event): string => {
  const routeId = getRouterParam(event, 'id')
  if (routeId) return routeId

  const pathname = event.node.req.url ? new URL(event.node.req.url, 'http://localhost').pathname : ''
  const archiveMatch = /^\/api\/dashboards\/([^/]+)\/archive$/.exec(pathname)
  const dashboardMatch = /^\/api\/dashboards\/([^/]+)$/.exec(pathname)
  const id = archiveMatch?.[1] ?? dashboardMatch?.[1]
  if (!id) throw new ApiError(404, 'dashboard_not_found', 'Dashboard was not found.')
  return decodeURIComponent(id)
}

const getRequestedDashboardId = (event: H3Event): string | null => {
  const value = getQuery(event).dashboard
  return typeof value === 'string' && value.length > 0 ? value : null
}

const toDashboardApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error
  if (error instanceof DashboardValidationError) {
    return new ApiError(400, error.code, 'Dashboard input is invalid.')
  }
  if (hasStatus(error, 401) || hasStatus(error, 403)) {
    return new ApiError(401, 'unauthenticated', 'Authentication is required.')
  }

  return new ApiError(503, 'dashboards_unavailable', 'Dashboards are temporarily unavailable. Please retry.')
}

export const handleDashboardError = (event: H3Event, error: unknown): ReturnType<typeof apiErrorBody> => {
  const apiError = toDashboardApiError(error)
  setResponseStatus(event, apiError.statusCode)
  return apiErrorBody(apiError)
}

export const dashboardContext = async (event: H3Event, options: { mutation: boolean }): Promise<DashboardRequestContext> => {
  const runtimeConfig = getRuntimeConfig(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  if (options.mutation) {
    validateSameOrigin(h3HeaderReader(event), runtimeConfig)
    assertJsonRequest(event)
  }

  const { session } = await resolveSession({ event, runtimeConfig, cookies: h3CookieController(event) })
  if (!session) throw new ApiError(401, 'unauthenticated', 'Authentication is required.')
  if (!session.onboardingCompleted) {
    throw new ApiError(409, 'onboarding_required', 'Onboarding must be completed before dashboards are available.')
  }

  return {
    event,
    ownerId: session.id,
    pb: getRequestPocketBase(event, runtimeConfig, event.context.pocketBaseAuthToken),
  }
}

export const dashboardShell = async (context: DashboardRequestContext): Promise<DashboardShellDto> => (
  shellFor(context.pb, context.ownerId, getRequestedDashboardId(context.event))
)

export const createDashboard = async (context: DashboardRequestContext): Promise<DashboardShellDto> => {
  const input = parseCreateDashboardInput(await readBody(context.event))
  const dashboards = await loadOwnerDashboards(context.pb, context.ownerId)
  const nextSortOrder = dashboards.length === 0 ? 0 : Math.max(...dashboards.map((dashboard) => dashboard.sortOrder)) + 1
  const created = mapDashboardRecord(await asDashboardCollection(context.pb).create({
    owner: context.ownerId,
    name: input.name,
    sortOrder: nextSortOrder,
    seedKey: '',
    archivedAt: '',
  }))
  await persistActiveDashboard(context.pb, context.ownerId, created.id)
  setResponseStatus(context.event, 201)

  return shellFor(context.pb, context.ownerId, created.id)
}

export const setActiveDashboard = async (context: DashboardRequestContext): Promise<DashboardShellDto> => {
  const input = parseActiveDashboardInput(await readBody(context.event))
  const dashboards = await ownerDashboards(context.pb, context.ownerId)
  const target = dashboards.find((dashboard) => dashboard.id === input.dashboardId)
  if (!target) throw new ApiError(404, 'dashboard_not_found', 'Dashboard was not found.')
  if (target.archivedAt !== null) {
    throw new ApiError(409, 'dashboard_state_inconsistent', 'Dashboard state is incompatible with this operation.')
  }

  await persistActiveDashboard(context.pb, context.ownerId, target.id)
  return shellFor(context.pb, context.ownerId, target.id)
}

export const renameDashboard = async (context: DashboardRequestContext): Promise<DashboardShellDto> => {
  const dashboardId = requireDashboardId(context.event)
  const input = parseRenameDashboardInput(await readBody(context.event))
  const dashboards = await ownerDashboards(context.pb, context.ownerId)
  const target = dashboards.find((dashboard) => dashboard.id === dashboardId)
  if (!target) throw new ApiError(404, 'dashboard_not_found', 'Dashboard was not found.')
  if (target.archivedAt !== null) {
    throw new ApiError(409, 'dashboard_state_inconsistent', 'Dashboard state is incompatible with this operation.')
  }

  await asDashboardCollection(context.pb).update(target.id, { name: input.name })
  return shellFor(context.pb, context.ownerId)
}

export const reorderDashboards = async (context: DashboardRequestContext): Promise<DashboardShellDto> => {
  const body = await readBody(context.event)
  const dashboards = await ownerDashboards(context.pb, context.ownerId)
  let plan
  try {
    plan = validateOwnerDashboardReorder(body, context.ownerId, dashboards)
  } catch (error) {
    if (error instanceof DashboardValidationError) {
      throw new ApiError(409, 'dashboard_order_conflict', 'Dashboard order is stale or invalid.')
    }
    throw error
  }

  const originalSortOrderByDashboardId = Object.fromEntries(
    dashboards.map((dashboard) => [dashboard.id, dashboard.sortOrder]),
  )
  const updatedDashboardIds: string[] = []

  try {
    for (const dashboardId of plan.dashboardIds) {
      await asDashboardCollection(context.pb).update(dashboardId, {
        sortOrder: plan.sortOrderByDashboardId[dashboardId],
      })
      updatedDashboardIds.push(dashboardId)
    }
  } catch (error) {
    for (const dashboardId of updatedDashboardIds.reverse()) {
      const originalSortOrder = originalSortOrderByDashboardId[dashboardId]
      if (typeof originalSortOrder === 'number') {
        await asDashboardCollection(context.pb).update(dashboardId, { sortOrder: originalSortOrder })
      }
    }
    throw error
  }

  return shellFor(context.pb, context.ownerId)
}

export const archiveDashboard = async (context: DashboardRequestContext): Promise<DashboardShellDto> => {
  parseArchiveDashboardInput(await readBody(context.event))
  const dashboardId = requireDashboardId(context.event)
  const dashboards = await ownerDashboards(context.pb, context.ownerId)
  const preferences = await loadPreferences(context.pb, context.ownerId)
  const target = dashboards.find((dashboard) => dashboard.id === dashboardId)
  if (!target) throw new ApiError(404, 'dashboard_not_found', 'Dashboard was not found.')

  let decision
  try {
    decision = validateOwnerDashboardArchive({
      ownerId: context.ownerId,
      dashboardId,
      activeDashboardId: preferences.activeDashboardId,
      dashboards,
    })
  } catch (error) {
    if (error instanceof DashboardValidationError) {
      throw new ApiError(409, 'dashboard_state_inconsistent', 'Dashboard state is incompatible with this operation.')
    }
    throw error
  }

  if (decision.requiresActiveDashboardChange) {
    if (!decision.fallbackActiveDashboardId) {
      throw new ApiError(409, 'dashboard_state_inconsistent', 'Dashboard state is incompatible with this operation.')
    }
    await persistActiveDashboard(context.pb, context.ownerId, decision.fallbackActiveDashboardId)
  }

  await asDashboardCollection(context.pb).update(decision.dashboardId, {
    archivedAt: new Date().toISOString(),
  })

  return shellFor(context.pb, context.ownerId, decision.fallbackActiveDashboardId)
}
