import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from '#imports'

import { useDashboards } from '../../app/composables/useDashboards'
import type { SessionValidationState } from '../../app/composables/useSession'
import type { SafeSessionDto } from '../../shared/types/auth'
import type { DashboardShellDto } from '../../shared/types/dashboard'

const completedUser: SafeSessionDto = {
  id: 'completed-user',
  displayName: 'Ada Lovelace',
  avatarKey: 'avatar-01',
  onboardingCompleted: true,
}

const workShell: DashboardShellDto = {
  dashboards: [
    { id: 'home-completed-user', name: 'Home', sortOrder: 0, isHome: true },
    { id: 'work-completed-user', name: 'Work', sortOrder: 1, isHome: false },
  ],
  activeDashboardId: 'work-completed-user',
  activeDashboard: { id: 'work-completed-user', name: 'Work', sortOrder: 1, isHome: false },
}

const homeShell: DashboardShellDto = {
  ...workShell,
  activeDashboardId: 'home-completed-user',
  activeDashboard: { id: 'home-completed-user', name: 'Home', sortOrder: 0, isHome: true },
}

const setSessionState = (
  session: SafeSessionDto | null,
  validationState: SessionValidationState = 'ready',
  validationMessage = '',
) => {
  useState<SafeSessionDto | null>('kunai.safe-session', () => null).value = session
  useState<SessionValidationState>('kunai.session-validation-state', () => 'idle').value = validationState
  useState<string>('kunai.session-validation-message', () => '').value = validationMessage
  useState<number>('kunai.session-request-epoch', () => 0).value = 0
}

const resetDashboardState = () => {
  useState<DashboardShellDto | null>('kunai.dashboard-shell', () => null).value = null
  useState<string>('kunai.dashboard-load-state', () => 'idle').value = 'idle'
  useState<string>('kunai.dashboard-error-message', () => '').value = ''
  useState<number>('kunai.dashboard-request-epoch', () => 0).value = 0
  useState<string | null>('kunai.dashboard-owner-session-id', () => null).value = null
}

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setSessionState(null, 'idle')
  resetDashboardState()
})

describe('useDashboards SSR-safe state', () => {
  it('loads authorized dashboard shell DTOs from /api/dashboards and exposes the server-selected active dashboard', async () => {
    setSessionState(completedUser)
    vi.stubGlobal('$fetch', vi.fn(async () => workShell))

    const dashboards = useDashboards()
    await dashboards.load()

    expect(dashboards.dashboards.value.map((dashboard) => dashboard.name)).toEqual(['Home', 'Work'])
    expect(dashboards.activeDashboardId.value).toBe('work-completed-user')
    expect(dashboards.activeDashboard.value?.name).toBe('Work')
    expect(dashboards.loadState.value).toBe('ready')
    expect(dashboards.error.value).toBe('')
  })

  it('passes a requested dashboard query to the server but trusts only the returned active dashboard', async () => {
    setSessionState(completedUser)
    const fetchMock = vi.fn(async () => homeShell)
    vi.stubGlobal('$fetch', fetchMock)

    const dashboards = useDashboards()
    await dashboards.load('foreign-dashboard')

    expect(fetchMock).toHaveBeenCalledWith('/api/dashboards?dashboard=foreign-dashboard')
    expect(dashboards.activeDashboardId.value).toBe('home-completed-user')
    expect(dashboards.activeDashboard.value?.name).toBe('Home')
  })

  it('keeps stale responses from overwriting newer dashboard state', async () => {
    setSessionState(completedUser)
    const first = deferred<DashboardShellDto>()
    const second = deferred<DashboardShellDto>()
    vi.stubGlobal('$fetch', vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise))

    const dashboards = useDashboards()
    const firstLoad = dashboards.load()
    const secondLoad = dashboards.load()

    second.resolve(homeShell)
    await secondLoad
    expect(dashboards.activeDashboardId.value).toBe('home-completed-user')

    first.resolve(workShell)
    await firstLoad
    expect(dashboards.activeDashboardId.value).toBe('home-completed-user')
  })

  it('clears private dashboard state when auth invalidation wins before a pending response resolves', async () => {
    setSessionState(completedUser)
    const pending = deferred<DashboardShellDto>()
    vi.stubGlobal('$fetch', vi.fn(async () => pending.promise))

    const dashboards = useDashboards()
    const load = dashboards.load()

    setSessionState(null, 'ready')
    await nextTick()
    pending.resolve(workShell)
    await load

    expect(dashboards.shell.value).toBeNull()
    expect(dashboards.activeDashboard.value).toBeNull()
  })

  it('clears previous dashboard state and rejects old responses when completed session identity changes', async () => {
    setSessionState(completedUser)
    const pending = deferred<DashboardShellDto>()
    vi.stubGlobal('$fetch', vi.fn()
      .mockResolvedValueOnce(workShell)
      .mockReturnValueOnce(pending.promise))

    const dashboards = useDashboards()
    await dashboards.load()
    expect(dashboards.activeDashboard.value?.name).toBe('Work')

    const oldLoad = dashboards.load()
    setSessionState({ ...completedUser, id: 'next-user', displayName: 'Next User' })
    await nextTick()
    expect(dashboards.shell.value).toBeNull()

    pending.resolve(workShell)
    await oldLoad
    expect(dashboards.shell.value).toBeNull()
  })

  it('sanitizes outages and invalid payloads without reusing stale private data', async () => {
    setSessionState(completedUser)
    vi.stubGlobal('$fetch', vi.fn(async () => workShell))

    const dashboards = useDashboards()
    await dashboards.load()
    expect(dashboards.activeDashboard.value?.name).toBe('Work')

    vi.stubGlobal('$fetch', vi.fn(async () => {
      const error = new Error('PocketBase outage: pb_secret_token') as Error & { statusCode: number }
      error.statusCode = 503
      throw error
    }))

    await dashboards.refresh()
    expect(dashboards.shell.value).toBeNull()
    expect(dashboards.error.value).toBe('Dashboards are temporarily unavailable.')

    vi.stubGlobal('$fetch', vi.fn(async () => ({ token: 'pb_secret_token' })))
    await dashboards.refresh()
    expect(dashboards.shell.value).toBeNull()
    expect(dashboards.error.value).toBe('Dashboards could not be loaded.')
  })
})
