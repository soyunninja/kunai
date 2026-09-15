export interface DashboardTabDto {
  readonly id: string
  readonly name: string
  readonly sortOrder: number
  readonly isHome: boolean
}

export interface DashboardShellDto {
  readonly dashboards: readonly DashboardTabDto[]
  readonly activeDashboardId: string
  readonly activeDashboard: DashboardTabDto
}

/**
 * Server-side dashboard state after PocketBase data has been mapped at the
 * data-access boundary. This is not a browser-facing DTO.
 */
export interface DashboardState {
  readonly id: string
  readonly ownerId: string
  readonly name: string
  readonly sortOrder: number
  readonly seedKey: string | null
  readonly archivedAt: string | null
}

export interface DashboardCreateInput {
  readonly name: string
}

export interface DashboardRenameInput {
  readonly name: string
}

export interface DashboardActiveSelectionInput {
  readonly dashboardId: string
}

export interface DashboardReorderInput {
  readonly dashboardIds: readonly string[]
}

export type DashboardArchiveInput = Readonly<Record<never, never>>

export interface ResolveActiveDashboardInput {
  readonly ownerId: string
  readonly dashboards: readonly DashboardState[]
  readonly requestedDashboardId?: string | null
  readonly persistedActiveDashboardId?: string | null
}

export interface DashboardReorderContext {
  readonly ownerId: string
  readonly dashboards: readonly DashboardState[]
}

export interface DashboardReorderPlan {
  readonly dashboardIds: readonly string[]
  readonly sortOrderByDashboardId: Readonly<Record<string, number>>
}

export interface DashboardArchivePolicyInput {
  readonly ownerId: string
  readonly dashboardId: string
  readonly activeDashboardId: string | null
  readonly dashboards: readonly DashboardState[]
}

export interface DashboardArchiveDecision {
  readonly dashboardId: string
  readonly requiresActiveDashboardChange: boolean
  readonly fallbackActiveDashboardId: string | null
}
