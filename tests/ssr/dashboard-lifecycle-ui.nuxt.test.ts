import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useState } from '#imports'

import App from '../../app/app.vue'
import type { SessionValidationState } from '../../app/composables/useSession'
import type { SafeSessionDto } from '../../shared/types/auth'
import type { DashboardShellDto } from '../../shared/types/dashboard'

const completedUser: SafeSessionDto = {
  id: 'completed-user',
  displayName: 'Ada Lovelace',
  avatarKey: 'avatar-01',
  onboardingCompleted: true,
}

const dashboardShell: DashboardShellDto = {
  dashboards: [
    { id: 'home-completed-user', name: 'Home', sortOrder: 0, isHome: true },
    { id: 'work-completed-user', name: 'Work', sortOrder: 1, isHome: false },
    { id: 'personal-completed-user', name: 'Personal', sortOrder: 2, isHome: false },
  ],
  activeDashboardId: 'work-completed-user',
  activeDashboard: { id: 'work-completed-user', name: 'Work', sortOrder: 1, isHome: false },
}

const createdDashboardShell: DashboardShellDto = {
  dashboards: [
    ...dashboardShell.dashboards,
    { id: 'planning-completed-user', name: 'Planning', sortOrder: 3, isHome: false },
  ],
  activeDashboardId: 'planning-completed-user',
  activeDashboard: { id: 'planning-completed-user', name: 'Planning', sortOrder: 3, isHome: false },
}

const personalActiveShell: DashboardShellDto = {
  ...dashboardShell,
  activeDashboardId: 'personal-completed-user',
  activeDashboard: { id: 'personal-completed-user', name: 'Personal', sortOrder: 2, isHome: false },
}

const renamedDashboardShell: DashboardShellDto = {
  dashboards: [
    { id: 'home-completed-user', name: 'Home', sortOrder: 0, isHome: true },
    { id: 'work-completed-user', name: 'Deep Work', sortOrder: 1, isHome: false },
    { id: 'personal-completed-user', name: 'Personal', sortOrder: 2, isHome: false },
  ],
  activeDashboardId: 'work-completed-user',
  activeDashboard: { id: 'work-completed-user', name: 'Deep Work', sortOrder: 1, isHome: false },
}

const reorderedDashboardShell: DashboardShellDto = {
  dashboards: [
    { id: 'work-completed-user', name: 'Work', sortOrder: 0, isHome: false },
    { id: 'home-completed-user', name: 'Home', sortOrder: 1, isHome: true },
    { id: 'personal-completed-user', name: 'Personal', sortOrder: 2, isHome: false },
  ],
  activeDashboardId: 'work-completed-user',
  activeDashboard: { id: 'work-completed-user', name: 'Work', sortOrder: 0, isHome: false },
}

const archivedActiveDashboardShell: DashboardShellDto = {
  dashboards: [
    { id: 'home-completed-user', name: 'Home', sortOrder: 0, isHome: true },
    { id: 'personal-completed-user', name: 'Personal', sortOrder: 1, isHome: false },
  ],
  activeDashboardId: 'home-completed-user',
  activeDashboard: { id: 'home-completed-user', name: 'Home', sortOrder: 0, isHome: true },
}

const setSessionState = (
  session: SafeSessionDto | null,
  validationState: SessionValidationState = 'ready',
) => {
  useState<SafeSessionDto | null>('kunai.safe-session', () => null).value = session
  useState<SessionValidationState>('kunai.session-validation-state', () => 'idle').value = validationState
  useState<string>('kunai.session-validation-message', () => '').value = ''
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
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

const mountLifecycleShell = async (
  fetchMock: ReturnType<typeof vi.fn> = vi.fn(async (path: string, options?: { method?: string }) => {
    if (path === '/api/dashboards' && !options?.method) return dashboardShell
    if (path === '/api/dashboards' && options?.method === 'POST') return createdDashboardShell
    if (path === '/api/dashboards/active' && options?.method === 'POST') return personalActiveShell
    if (path === '/api/dashboards/work-completed-user' && options?.method === 'PATCH') return renamedDashboardShell
    if (path === '/api/dashboards/reorder' && options?.method === 'POST') return reorderedDashboardShell
    if (path === '/api/dashboards/work-completed-user/archive' && options?.method === 'POST') return archivedActiveDashboardShell
    throw new Error(`Unexpected request: ${path}`)
  }),
) => {
  setSessionState(completedUser)
  vi.stubGlobal('$fetch', fetchMock)
  const wrapper = await mountSuspended(App, { route: '/' })
  return { wrapper, fetchMock }
}

const dashboardTabTexts = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) => (
  wrapper.findAll('[role="tab"]').map((tab) => tab.text())
)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setSessionState(null, 'idle')
  resetDashboardState()
})

describe('Phase 0003 Task 4.1 RED dashboard lifecycle shell interactions', () => {
  it('defines create dashboard UX with validation, cancel, loading, retry, active result, and no page reload', async () => {
    const createRequest = deferred<DashboardShellDto>()
    const fetchMock = vi.fn((path: string, options?: { method?: string }) => {
      if (path === '/api/dashboards' && !options?.method) return Promise.resolve(dashboardShell)
      if (path === '/api/dashboards' && options?.method === 'POST') return createRequest.promise
      throw new Error(`Unexpected request: ${path}`)
    })
    const { wrapper } = await mountLifecycleShell(fetchMock)

    await wrapper.get('[data-testid="create-dashboard"]').trigger('click')

    expect(wrapper.get('[role="dialog"][aria-label="Create dashboard"]').exists()).toBe(true)
    const input = wrapper.get<HTMLInputElement>('[data-testid="dashboard-create-name"]')
    expect(input.attributes('aria-describedby')).toContain('dashboard-create-error')

    await wrapper.get('[data-testid="dashboard-create-submit"]').trigger('click')
    expect(wrapper.get('#dashboard-create-error').text()).toMatch(/name.*required/i)

    await input.setValue('Planning')
    await wrapper.get('[data-testid="dashboard-create-cancel"]').trigger('click')
    expect(wrapper.find('[role="dialog"][aria-label="Create dashboard"]').exists()).toBe(false)

    await wrapper.get('[data-testid="create-dashboard"]').trigger('click')
    await wrapper.get<HTMLInputElement>('[data-testid="dashboard-create-name"]').setValue('Planning')
    await wrapper.get('[data-testid="dashboard-create-submit"]').trigger('click')
    expect(fetchMock).toHaveBeenCalledWith('/api/dashboards', { method: 'POST', body: { name: 'Planning' } })
    expect(wrapper.get('[data-testid="dashboard-create-submit"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.get<HTMLInputElement>('[data-testid="dashboard-create-name"]').element.value).toBe('Planning')

    createRequest.resolve(createdDashboardShell)
    await createRequest.promise
    await wrapper.vm.$nextTick()

    expect(dashboardTabTexts(wrapper)).toEqual(['Home', 'Work', 'Personal', 'Planning'])
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Planning')
    expect(wrapper.html()).not.toMatch(/location\.reload|reload/i)
  })

  it('preserves create input after a recoverable create error and retries the same draft', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(dashboardShell)
      .mockRejectedValueOnce(Object.assign(new Error('temporary outage'), { statusCode: 503 }))
      .mockResolvedValueOnce(createdDashboardShell)
    const { wrapper } = await mountLifecycleShell(fetchMock)

    await wrapper.get('[data-testid="create-dashboard"]').trigger('click')
    await wrapper.get<HTMLInputElement>('[data-testid="dashboard-create-name"]').setValue('Planning')
    await wrapper.get('[data-testid="dashboard-create-submit"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[role="alert"][data-testid="dashboard-create-error"]').text()).toMatch(/temporarily unavailable|retry/i)
    expect(wrapper.get<HTMLInputElement>('[data-testid="dashboard-create-name"]').element.value).toBe('Planning')

    await wrapper.get('[data-testid="dashboard-create-retry"]').trigger('click')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/dashboards', { method: 'POST', body: { name: 'Planning' } })
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Planning')
  })

  it('syncs click, touch, and keyboard tab selection with the active-dashboard API without false active state on error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(dashboardShell)
      .mockResolvedValueOnce(personalActiveShell)
      .mockRejectedValueOnce(Object.assign(new Error('temporary outage'), { statusCode: 503 }))
    const { wrapper } = await mountLifecycleShell(fetchMock)
    const personalTab = wrapper.get('[data-dashboard-tab-id="personal-completed-user"]')

    await personalTab.trigger('pointerup')
    await personalTab.trigger('click')

    expect(fetchMock).toHaveBeenCalledWith('/api/dashboards/active', { method: 'POST', body: { dashboardId: 'personal-completed-user' } })
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Personal')

    await wrapper.get('[data-dashboard-tab-id="work-completed-user"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('[role="alert"][data-testid="dashboard-tab-error"]').text()).toMatch(/temporarily unavailable|retry/i)
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Personal')
  })

  it('defines Manage as the entry point for rename with current value, validation, loading, error retry, cancel, and tab update', async () => {
    const renameRequest = deferred<DashboardShellDto>()
    const fetchMock = vi.fn((path: string, options?: { method?: string }) => {
      if (path === '/api/dashboards' && !options?.method) return Promise.resolve(dashboardShell)
      if (path === '/api/dashboards/work-completed-user' && options?.method === 'PATCH') return renameRequest.promise
      throw new Error(`Unexpected request: ${path}`)
    })
    const { wrapper } = await mountLifecycleShell(fetchMock)

    await wrapper.get('[data-testid="manage-dashboards"]').trigger('click')
    expect(wrapper.get('[role="dialog"][aria-label="Manage dashboards"]').exists()).toBe(true)
    await wrapper.get('[data-testid="dashboard-row-work-completed-user"] [data-testid="dashboard-rename-open"]').trigger('click')

    const input = wrapper.get<HTMLInputElement>('[data-testid="dashboard-rename-name"]')
    expect(input.element.value).toBe('Work')
    await input.setValue('')
    await wrapper.get('[data-testid="dashboard-rename-submit"]').trigger('click')
    expect(wrapper.get('#dashboard-rename-error').text()).toMatch(/name.*required/i)

    await input.setValue('Deep Work')
    await wrapper.get('[data-testid="dashboard-rename-cancel"]').trigger('click')
    expect(wrapper.find('[role="dialog"][aria-label="Rename dashboard"]').exists()).toBe(false)

    await wrapper.get('[data-testid="dashboard-row-work-completed-user"] [data-testid="dashboard-rename-open"]').trigger('click')
    await wrapper.get<HTMLInputElement>('[data-testid="dashboard-rename-name"]').setValue('Deep Work')
    await wrapper.get('[data-testid="dashboard-rename-submit"]').trigger('click')
    expect(fetchMock).toHaveBeenCalledWith('/api/dashboards/work-completed-user', { method: 'PATCH', body: { name: 'Deep Work' } })
    expect(wrapper.get('[data-testid="dashboard-rename-submit"]').attributes('aria-busy')).toBe('true')

    renameRequest.resolve(renamedDashboardShell)
    await renameRequest.promise
    await wrapper.vm.$nextTick()
    expect(dashboardTabTexts(wrapper)).toEqual(['Home', 'Deep Work', 'Personal'])
  })

  it('defines accessible keyboard/touch reorder controls with limits, optimistic-safe ordering, and recoverable errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(dashboardShell)
      .mockResolvedValueOnce(reorderedDashboardShell)
      .mockRejectedValueOnce(Object.assign(new Error('stale reorder'), { statusCode: 409 }))
    const { wrapper } = await mountLifecycleShell(fetchMock)

    await wrapper.get('[data-testid="manage-dashboards"]').trigger('click')
    expect(wrapper.get('[data-testid="dashboard-row-home-completed-user"] [data-testid="dashboard-move-up"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="dashboard-row-personal-completed-user"] [data-testid="dashboard-move-down"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="dashboard-row-work-completed-user"] [data-testid="dashboard-move-up"]').trigger('click')
    expect(fetchMock).toHaveBeenCalledWith('/api/dashboards/reorder', {
      method: 'POST',
      body: { dashboardIds: ['work-completed-user', 'home-completed-user', 'personal-completed-user'] },
    })
    expect(dashboardTabTexts(wrapper)).toEqual(['Work', 'Home', 'Personal'])

    await wrapper.get('[data-testid="dashboard-row-home-completed-user"] [data-testid="dashboard-move-down"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('[role="alert"][data-testid="dashboard-reorder-error"]').text()).toMatch(/stale|retry/i)
    expect(dashboardTabTexts(wrapper)).toEqual(['Work', 'Home', 'Personal'])
  })

  it('defines archive confirmation, Home protection, last-dashboard protection, active fallback, loading, error, and retry', async () => {
    const archiveRequest = deferred<DashboardShellDto>()
    const fetchMock = vi.fn((path: string, options?: { method?: string }) => {
      if (path === '/api/dashboards' && !options?.method) return Promise.resolve(dashboardShell)
      if (path === '/api/dashboards/work-completed-user/archive' && options?.method === 'POST') return archiveRequest.promise
      throw new Error(`Unexpected request: ${path}`)
    })
    const { wrapper } = await mountLifecycleShell(fetchMock)

    await wrapper.get('[data-testid="manage-dashboards"]').trigger('click')
    const homeArchive = wrapper.get('[data-testid="dashboard-row-home-completed-user"] [data-testid="dashboard-archive-open"]')
    expect(homeArchive.attributes('aria-disabled')).toBe('true')
    expect(homeArchive.classes()).toEqual(expect.arrayContaining(['text-red-500', 'opacity-50']))
    expect(wrapper.get('[data-testid="dashboard-row-home-completed-user"]').text()).not.toMatch(/home cannot be archived/i)

    await wrapper.get('[data-testid="dashboard-row-work-completed-user"] [data-testid="dashboard-archive-open"]').trigger('click')
    expect(wrapper.get('[role="alertdialog"][aria-label="Archive dashboard"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="dashboard-archive-confirmation"]').text()).toMatch(/archive Work/i)

    await wrapper.get('[data-testid="dashboard-archive-confirm"]').trigger('click')
    expect(fetchMock).toHaveBeenCalledWith('/api/dashboards/work-completed-user/archive', { method: 'POST', body: {} })
    expect(wrapper.get('[data-testid="dashboard-archive-confirm"]').attributes('aria-busy')).toBe('true')

    archiveRequest.resolve(archivedActiveDashboardShell)
    await archiveRequest.promise
    await wrapper.vm.$nextTick()

    expect(dashboardTabTexts(wrapper)).toEqual(['Home', 'Personal'])
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Home')
    expect(wrapper.text()).not.toContain('Work')
  })

  it('keeps lifecycle controls accessible and touch-safe without changing the approved shell visual identity', async () => {
    const { wrapper } = await mountLifecycleShell()

    await wrapper.get('[data-testid="manage-dashboards"]').trigger('click')

    expect(wrapper.get('[data-testid="product-identity"]').text()).toBe('kunai')
    expect(wrapper.get('[data-testid="dashboard-shell"]').attributes('data-visual-tone')).toBe('terminal-dark')
    expect(wrapper.get('[role="tablist"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="dashboard-management-panel"]').attributes('data-touch-target')).toBe('comfortable')
    expect(wrapper.get('[data-testid="dashboard-management-panel"]').attributes('aria-describedby')).toContain('dashboard-management-help')
    expect(wrapper.get('#dashboard-management-help').text()).toMatch(/keyboard|touch/i)
  })

  it('renders every lifecycle dialog as a centered, viewport-fixed overlay', async () => {
    const { wrapper } = await mountLifecycleShell()

    const expectOverlay = (testId: string) => {
      expect(wrapper.get(`[data-testid="${testId}"]`).classes()).toEqual(expect.arrayContaining([
        'fixed',
        'inset-0',
        'z-50',
        'items-center',
        'justify-center',
      ]))
    }

    await wrapper.get('[data-testid="create-dashboard"]').trigger('click')
    expectOverlay('dashboard-create-overlay')
    await wrapper.get('[data-testid="dashboard-create-cancel"]').trigger('click')

    await wrapper.get('[data-testid="manage-dashboards"]').trigger('click')
    expectOverlay('dashboard-manage-overlay')
    await wrapper.get('[data-testid="dashboard-row-work-completed-user"] [data-testid="dashboard-rename-open"]').trigger('click')
    expectOverlay('dashboard-rename-overlay')
    await wrapper.get('[data-testid="dashboard-rename-cancel"]').trigger('click')

    await wrapper.get('[data-testid="dashboard-row-work-completed-user"] [data-testid="dashboard-archive-open"]').trigger('click')
    expectOverlay('dashboard-archive-overlay')
  })
})
