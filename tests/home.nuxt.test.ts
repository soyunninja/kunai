import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useState } from '#imports'

import App from '../app/app.vue'
import type { SessionValidationState } from '../app/composables/useSession'
import type { SafeSessionDto } from '../shared/types/auth'
import type { DashboardShellDto } from '../shared/types/dashboard'

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

const mountHome = async () => {
  setSessionState(completedUser)
  const fetchMock = vi.fn(async (path: string) => {
    if (path === '/api/dashboards') {
      return dashboardShell
    }
    if (path === '/api/home') {
      return {
        dashboard: {
          id: 'home-completed-user',
          name: 'Home',
        },
        initialized: true,
      }
    }
    throw new Error(`Unexpected request: ${path}`)
  })

  vi.stubGlobal('$fetch', fetchMock)
  const wrapper = await mountSuspended(App, { route: '/' })

  return { wrapper, fetchMock }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setSessionState(null)
  document.documentElement.removeAttribute('data-theme')
})

describe('Phase 0003 dashboard shell Home RED contract', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'dark'
  })

  it('replaces the Phase 0002 minimal Home with the protected dashboard shell entry point', async () => {
    const { wrapper, fetchMock } = await mountHome()

    expect(fetchMock).toHaveBeenCalledWith('/api/dashboards')
    expect(wrapper.get('main').attributes('aria-label')).toBe('Dashboard shell')
    expect(wrapper.find('[data-testid="dashboard-shell-heading"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="dashboard-shell"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="product-identity"]').text()).toMatch(/kunai/i)
    expect(wrapper.get('[data-testid="dashboard-header"]').exists()).toBe(true)
    expect(wrapper.get('[role="tablist"][aria-label="Dashboards"]').exists()).toBe(true)
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toContain('Home')
    expect(wrapper.get('[data-testid="active-dashboard-empty-state"]').text()).toContain('Home is empty.')

    wrapper.unmount()
  })

  it('keeps account, logout, settings entry, dashboard management, and existing appearance control available without exposing raw protected data', async () => {
    const { wrapper } = await mountHome()
    const appearance = wrapper.get<HTMLSelectElement>('#appearance')

    await appearance.setValue('light')
    await nextTick()

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(wrapper.get('[data-testid="user-identity"]').text()).toContain('Ada Lovelace')
    expect(wrapper.get('[data-testid="logout"]').text()).toMatch(/log out/i)
    expect(wrapper.get('[data-testid="settings-entry"]').text()).toMatch(/settings/i)
    expect(wrapper.get('[data-testid="manage-dashboards"]').text()).toMatch(/edit|manage/i)
    expect(wrapper.find('[data-safe-session]').exists()).toBe(false)
    expect(wrapper.find('pre').exists()).toBe(false)
    expect(wrapper.html()).not.toMatch(/token|authStore|collectionId|pocketbase/i)

    wrapper.unmount()
  })

  it('does not render widgets or grid features before later Phase 0003 tasks', async () => {
    const { wrapper } = await mountHome()
    const pageText = wrapper.text().toLowerCase()

    for (const deferredTerm of [
      'grid',
      'widget',
      'drag',
      'resize',
      'search',
      'clock',
      'weather',
      'bookmarks',
      'travel',
      'dev',
      'finance',
      'calendar',
    ]) {
      expect(pageText).not.toContain(deferredTerm)
    }

    wrapper.unmount()
  })
})
