import { nextTick } from 'vue'
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

const otherUser: SafeSessionDto = {
  id: 'other-user',
  displayName: 'Grace Hopper',
  avatarKey: 'avatar-02',
  onboardingCompleted: true,
}

const incompleteUser: SafeSessionDto = {
  id: 'incomplete-user',
  displayName: 'Incomplete User',
  avatarKey: 'avatar-03',
  onboardingCompleted: false,
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

const fallbackDashboardShell: DashboardShellDto = {
  ...dashboardShell,
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

const resetSessionState = () => {
  setSessionState(null, 'idle', '')
}

const mountDashboardRoute = async ({
  route = '/',
  session = completedUser,
  validationState,
  validationMessage = '',
  shell = dashboardShell,
}: {
  readonly route?: string
  readonly session?: SafeSessionDto | null
  readonly validationState?: SessionValidationState
  readonly validationMessage?: string
  readonly shell?: DashboardShellDto
} = {}) => {
  setSessionState(session, validationState ?? (session ? 'ready' : 'idle'), validationMessage)

  const fetchMock = vi.fn(async (path: string) => {
    if (path.startsWith('/api/dashboards')) {
      return shell
    }
    if (path === '/api/home') {
      return {
        dashboard: { id: 'home-completed-user', name: 'Home' },
        initialized: true,
      }
    }
    throw new Error(`Unexpected request: ${path}`)
  })

  vi.stubGlobal('$fetch', fetchMock)
  const wrapper = await mountSuspended(App, { route })

  return { wrapper, fetchMock }
}

const visibleText = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, '').toLowerCase()

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetSessionState()
  document.documentElement.removeAttribute('data-theme')
})

describe('Phase 0003 Dashboard Shell SSR/UI RED contract', () => {
  it('renders a protected dashboard shell for a completed user with product identity, dashboard header, tabs, and account actions', async () => {
    const { wrapper } = await mountDashboardRoute()

    expect(wrapper.get('main').attributes('aria-label')).toBe('Dashboard shell')
    expect(wrapper.find('[data-testid="dashboard-shell-heading"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="product-identity"]').text()).toMatch(/kunai/i)
    expect(wrapper.get('[data-testid="dashboard-header"]').exists()).toBe(true)
    expect(wrapper.get('[role="tablist"][aria-label="Dashboards"]').exists()).toBe(true)
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toContain('Work')
    expect(wrapper.get('[data-testid="create-dashboard"]').text()).toBe('+')
    expect(wrapper.get('[data-testid="manage-dashboards"]').text()).toMatch(/edit|manage/i)
    expect(wrapper.get('[data-testid="settings-entry"]').text()).toMatch(/settings/i)
    expect(wrapper.get('[data-testid="user-identity"]').text()).toContain('Ada Lovelace')
    expect(wrapper.get('[data-testid="logout"]').text()).toMatch(/log out/i)
    expect(wrapper.find('#appearance').exists()).toBe(false)
    expect(wrapper.get('[data-testid="active-dashboard-empty-state"]').text()).toMatch(/work/i)

    wrapper.unmount()
  })

  it('opens an accessible settings dialog with only the appearance options and reuses the active theme mode', async () => {
    const { wrapper } = await mountDashboardRoute()

    await wrapper.get('[data-testid="settings-entry"]').trigger('click')

    const dialog = wrapper.get('[role="dialog"][aria-labelledby="settings-heading"]')
    const selector = wrapper.get<HTMLSelectElement>('[data-testid="appearance-select"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(wrapper.get('#settings-heading').text()).toBe('Settings')
    expect(wrapper.get('#appearance-heading').text()).toBe('Appearance')
    expect(selector.findAll('option').map((option) => option.text())).toEqual(['Dark', 'Light', 'System'])

    await selector.setValue('light')
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('light')

    await selector.setValue('system')
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('system')

    await wrapper.get('[data-testid="settings-close"]').trigger('click')
    expect(wrapper.find('[role="dialog"][aria-labelledby="settings-heading"]').exists()).toBe(false)
    expect(wrapper.find('#appearance').exists()).toBe(false)

    wrapper.unmount()
  })

  it('keeps anonymous, incomplete, invalid, and unavailable sessions away from protected dashboard content', async () => {
    const anonymous = await mountDashboardRoute({ session: null })
    expect(anonymous.wrapper.html()).not.toContain('Ada Lovelace')
    expect(anonymous.wrapper.find('[data-testid="dashboard-shell"]').exists()).toBe(false)
    anonymous.wrapper.unmount()

    const incomplete = await mountDashboardRoute({ session: incompleteUser })
    expect(incomplete.wrapper.html()).toContain('Onboarding')
    expect(incomplete.wrapper.find('[data-testid="dashboard-shell"]').exists()).toBe(false)
    incomplete.wrapper.unmount()

    const invalid = await mountDashboardRoute({ session: null, validationState: 'ready' })
    expect(invalid.wrapper.html()).not.toContain('Ada Lovelace')
    expect(invalid.wrapper.find('[data-testid="dashboard-shell"]').exists()).toBe(false)
    invalid.wrapper.unmount()

    await expect(mountDashboardRoute({
      session: null,
      validationState: 'unavailable',
      validationMessage: 'Session could not be validated',
    })).rejects.toMatchObject({ statusCode: 503 })
  })

  it('derives the active dashboard from /api/dashboards, honors a valid query, and falls back to the server-selected allowed dashboard for invalid, archived, or foreign query values', async () => {
    const valid = await mountDashboardRoute({ route: '/?dashboard=work-completed-user' })
    expect(valid.fetchMock).toHaveBeenCalledWith('/api/dashboards?dashboard=work-completed-user')
    expect(valid.wrapper.get('[data-testid="home-name"]').text()).toContain('Work')
    valid.wrapper.unmount()

    for (const dashboardId of ['missing-dashboard', 'archived-dashboard', 'foreign-dashboard']) {
      const result = await mountDashboardRoute({ route: `/?dashboard=${dashboardId}`, shell: fallbackDashboardShell })
      expect(result.fetchMock).toHaveBeenCalledWith(`/api/dashboards?dashboard=${dashboardId}`)
      expect(result.wrapper.get('[data-testid="home-name"]').text()).toContain('Home')
      expect(result.wrapper.text()).not.toMatch(/missing-dashboard|archived-dashboard|foreign-dashboard|internal/i)
      result.wrapper.unmount()
    }
  })

  it('renders exactly one accessible horizontal tab per visible dashboard in API order, with non-color active state, keyboard semantics, and a separate create button', async () => {
    const { wrapper } = await mountDashboardRoute()
    const tabs = wrapper.findAll('[role="tab"]')

    expect(tabs).toHaveLength(3)
    expect(tabs.map((tab) => tab.text())).toEqual(['Home', 'Work', 'Personal'])
    expect(tabs.map((tab) => tab.attributes('aria-controls'))).toEqual([
      'dashboard-panel-home-completed-user',
      'dashboard-panel-work-completed-user',
      'dashboard-panel-personal-completed-user',
    ])
    expect(tabs[1]?.attributes('aria-selected')).toBe('true')
    expect(tabs[1]?.attributes('data-active')).toBe('true')
    expect(tabs[1]?.attributes('tabindex')).toBe('0')
    expect(wrapper.get('[role="tablist"]').attributes('aria-orientation')).toBe('horizontal')
    expect(wrapper.get('[data-testid="create-dashboard"]').attributes('aria-label')).toMatch(/create dashboard/i)
    expect(wrapper.get('[data-testid="create-dashboard"]').attributes('data-touch-target')).toBe('comfortable')

    wrapper.unmount()
  })

  it('protects the visual design direction without freezing cosmetic classes', async () => {
    const { wrapper } = await mountDashboardRoute()

    expect(wrapper.get('[data-testid="dashboard-shell"]').attributes('data-visual-tone')).toBe('terminal-dark')
    expect(wrapper.get('[data-testid="dashboard-shell"]').attributes('data-density')).toBe('compact')
    expect(wrapper.get('[data-testid="dashboard-shell"]').attributes('data-layout')).toBe('responsive-dashboard-tabs')
    expect(wrapper.get('[data-testid="dashboard-shell"]').attributes('data-font-intent')).toBe('monospace')

    wrapper.unmount()
  })

  it('keeps protected SSR output private, sanitized, and free of raw session, token, and PocketBase internals', async () => {
    const { wrapper } = await mountDashboardRoute()
    const html = wrapper.html()
    const text = visibleText(html)

    expect(wrapper.get('[data-testid="dashboard-shell"]').attributes('data-cache')).toBe('private-no-store')
    expect(html).not.toContain('data-safe-session')
    expect(html).not.toContain('pb_secret')
    expect(html).not.toContain('authStore')
    expect(html).not.toContain('collectionId')
    expect(html).not.toContain('raw session')
    expect(text).not.toContain('token')
    expect(wrapper.find('pre').exists()).toBe(false)

    wrapper.unmount()
  })

  it('is hydration-compatible: server-selected active tab and shell landmarks remain stable after client tick', async () => {
    const { wrapper } = await mountDashboardRoute()
    const before = wrapper.html()

    await nextTick()

    expect(wrapper.get('[data-testid="home-name"]').text()).toContain('Work')
    expect(wrapper.get('main').exists()).toBe(true)
    expect(wrapper.html()).not.toContain('hydration mismatch')
    expect(before).toContain('Private dashboard state loaded.')

    wrapper.unmount()
  })

  it('does not flash another user dashboard data while a completed session changes', async () => {
    const first = await mountDashboardRoute({ session: otherUser, shell: {
      dashboards: [{ id: 'home-other-user', name: 'Other Home', sortOrder: 0, isHome: true }],
      activeDashboardId: 'home-other-user',
      activeDashboard: { id: 'home-other-user', name: 'Other Home', sortOrder: 0, isHome: true },
    } })
    first.wrapper.unmount()

    const second = await mountDashboardRoute({ session: completedUser, shell: dashboardShell })

    expect(second.wrapper.text()).toContain('Ada Lovelace')
    expect(second.wrapper.text()).toContain('Work')
    expect(second.wrapper.text()).not.toContain('Grace Hopper')
    expect(second.wrapper.text()).not.toContain('Other Home')

    second.wrapper.unmount()
  })

  it('does not use localStorage or browser PocketBase SDK authority for dashboard state', async () => {
    const localStorageGetItem = vi.spyOn(window.localStorage.__proto__, 'getItem')
    const { wrapper, fetchMock } = await mountDashboardRoute()

    expect(fetchMock).toHaveBeenCalledWith('/api/dashboards')
    expect(localStorageGetItem).not.toHaveBeenCalledWith(expect.stringMatching(/dashboard/i))
    expect(wrapper.html()).not.toContain('pocketbase')

    wrapper.unmount()
  })
})
