import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useState } from '#imports'

import App from '../app/app.vue'
import type { SessionValidationState } from '../app/composables/useSession'
import type { SafeSessionDto } from '../shared/types/auth'

const completedUser: SafeSessionDto = {
  id: 'completed-user',
  displayName: 'Ada Lovelace',
  avatarKey: 'avatar-01',
  onboardingCompleted: true,
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
  vi.stubGlobal('$fetch', vi.fn(async (path: string) => {
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
  }))

  return await mountSuspended(App, { route: '/' })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setSessionState(null)
  document.documentElement.removeAttribute('data-theme')
})

describe('Phase 0002 minimal protected Home RED contract', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'dark'
  })

  it('renders only the authenticated user, initialized private Home, main landmark, and accessible logout', async () => {
    const wrapper = await mountHome()

    expect(wrapper.get('main').exists()).toBe(true)
    expect(wrapper.get('[data-testid="authenticated-user"]').text()).toContain('Ada Lovelace')
    expect(wrapper.get('[data-testid="home-name"]').text()).toBe('Home')
    expect(wrapper.get('[data-testid="home-initialized"]').text()).toMatch(/initialized/i)

    const logout = wrapper.get<HTMLButtonElement>('[data-testid="logout"]')
    expect(logout.element).toBeInstanceOf(HTMLButtonElement)
    expect(logout.attributes('type')).toBe('button')
    expect(logout.text()).toMatch(/log out/i)

    wrapper.unmount()
  })

  it('preserves appearance controls while withholding raw session data and future dashboard product controls', async () => {
    const wrapper = await mountHome()
    const pageText = wrapper.text().toLowerCase()
    const appearance = wrapper.get<HTMLSelectElement>('#appearance')

    await appearance.setValue('light')
    await nextTick()

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(wrapper.find('[data-safe-session]').exists()).toBe(false)
    expect(wrapper.find('pre').exists()).toBe(false)
    for (const futureTerm of [
      'dashboard tabs',
      'grid',
      'widget',
      'drag',
      'edit',
      'settings',
      'travel',
      'dev',
      'finance',
      'calendar',
    ]) {
      expect(pageText).not.toContain(futureTerm)
    }

    wrapper.unmount()
  })
})
