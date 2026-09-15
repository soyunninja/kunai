import { computed, readonly, watch } from 'vue'
import { useRoute, useState } from '#imports'

import type { DashboardShellDto, DashboardTabDto } from '../../shared/types/dashboard'
import { useSession } from './useSession'

export type DashboardLoadState = 'idle' | 'loading' | 'ready' | 'unavailable'

const isDashboardTabDto = (value: unknown): value is DashboardTabDto => (
  typeof value === 'object'
  && value !== null
  && 'id' in value
  && typeof value.id === 'string'
  && 'name' in value
  && typeof value.name === 'string'
  && 'sortOrder' in value
  && typeof value.sortOrder === 'number'
  && 'isHome' in value
  && typeof value.isHome === 'boolean'
)

const isDashboardShellDto = (value: unknown): value is DashboardShellDto => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<DashboardShellDto>
  return Array.isArray(candidate.dashboards)
    && candidate.dashboards.every(isDashboardTabDto)
    && typeof candidate.activeDashboardId === 'string'
    && isDashboardTabDto(candidate.activeDashboard)
}

const dashboardErrorMessage = (error: unknown): string => {
  const statusCode = typeof error === 'object'
    && error !== null
    && 'statusCode' in error
    && typeof error.statusCode === 'number'
    ? error.statusCode
    : 0

  if (statusCode === 401) {
    return 'Dashboard session could not be validated.'
  }

  if (statusCode === 409) {
    return 'Dashboard setup is incomplete.'
  }

  if (statusCode === 503) {
    return 'Dashboards are temporarily unavailable.'
  }

  return 'Dashboards could not be loaded.'
}

const dashboardPath = (requestedDashboardId: string | null) => (
  requestedDashboardId ? `/api/dashboards?dashboard=${encodeURIComponent(requestedDashboardId)}` : '/api/dashboards'
)

export const useDashboards = () => {
  const route = useRoute()
  const { session, validationState } = useSession()
  const shell = useState<DashboardShellDto | null>('kunai.dashboard-shell', () => null)
  const loadState = useState<DashboardLoadState>('kunai.dashboard-load-state', () => 'idle')
  const errorMessage = useState<string>('kunai.dashboard-error-message', () => '')
  const requestEpoch = useState<number>('kunai.dashboard-request-epoch', () => 0)
  const ownerSessionId = useState<string | null>('kunai.dashboard-owner-session-id', () => null)

  const dashboards = computed(() => shell.value?.dashboards ?? [])
  const activeDashboardId = computed(() => shell.value?.activeDashboardId ?? null)
  const activeDashboard = computed(() => {
    if (!shell.value) return null
    return shell.value.dashboards.find((dashboard) => dashboard.id === shell.value?.activeDashboardId) ?? shell.value.activeDashboard
  })
  const loading = computed(() => loadState.value === 'loading')
  const error = computed(() => errorMessage.value)

  const beginRequest = () => {
    requestEpoch.value += 1
    loadState.value = 'loading'
    errorMessage.value = ''
    return requestEpoch.value
  }

  const acceptResponse = (epoch: number) => epoch === requestEpoch.value

  const clear = () => {
    requestEpoch.value += 1
    ownerSessionId.value = null
    shell.value = null
    loadState.value = 'idle'
    errorMessage.value = ''
  }

  watch([session, validationState], ([currentSession, currentValidationState]) => {
    if (!currentSession?.onboardingCompleted || currentValidationState === 'unavailable') {
      clear()
      return
    }

    if (ownerSessionId.value && ownerSessionId.value !== currentSession.id) {
      clear()
    }
  }, { immediate: true })

  const applyShell = (epoch: number, requestSessionId: string, nextShell: DashboardShellDto) => {
    if (
      !acceptResponse(epoch)
      || !session.value?.onboardingCompleted
      || session.value.id !== requestSessionId
      || validationState.value === 'unavailable'
    ) {
      return shell.value
    }

    ownerSessionId.value = requestSessionId
    shell.value = nextShell
    loadState.value = 'ready'
    errorMessage.value = ''
    return shell.value
  }

  const handleFailure = (epoch: number, error: unknown) => {
    if (!acceptResponse(epoch)) {
      return shell.value
    }

    shell.value = null
    loadState.value = 'unavailable'
    errorMessage.value = dashboardErrorMessage(error)
    return shell.value
  }

  const load = async (requestedDashboardId?: string | null) => {
    if (!session.value?.onboardingCompleted || validationState.value === 'unavailable') {
      clear()
      return shell.value
    }

    const requestSessionId = session.value.id
    const epoch = beginRequest()
    const queryDashboardId = requestedDashboardId
      ?? (typeof route.query.dashboard === 'string' ? route.query.dashboard : null)

    try {
      const response = await $fetch<unknown>(dashboardPath(queryDashboardId))
      if (!isDashboardShellDto(response)) {
        throw new Error('Invalid dashboard shell payload')
      }

      return applyShell(epoch, requestSessionId, response)
    } catch (error) {
      return handleFailure(epoch, error)
    }
  }

  const refresh = async () => load()

  const setActive = async (dashboardId: string) => {
    if (!dashboards.value.some((dashboard) => dashboard.id === dashboardId)) {
      errorMessage.value = 'Dashboard selection is not available.'
      return shell.value
    }

    if (!session.value?.onboardingCompleted || validationState.value === 'unavailable') {
      clear()
      return shell.value
    }

    const requestSessionId = session.value.id
    const epoch = beginRequest()

    try {
      const response = await $fetch<unknown>('/api/dashboards/active', {
        method: 'POST',
        body: { dashboardId },
      })
      if (!isDashboardShellDto(response)) {
        throw new Error('Invalid dashboard shell payload')
      }

      return applyShell(epoch, requestSessionId, response)
    } catch (error) {
      return handleFailure(epoch, error)
    }
  }

  return {
    shell: readonly(shell),
    dashboards,
    activeDashboardId,
    activeDashboard,
    loadState: readonly(loadState),
    loading,
    error,
    load,
    refresh,
    setActive,
    clear,
  }
}
