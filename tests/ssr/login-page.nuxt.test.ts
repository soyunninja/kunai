import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { useState } from '#imports'

import App from '../../app/app.vue'
import type { SafeSessionDto } from '../../shared/types/auth'
import type { SessionValidationState } from '../../app/composables/useSession'

const completedUser: SafeSessionDto = {
  id: 'completed-user',
  displayName: 'Completed User',
  avatarKey: 'avatar-complete',
  onboardingCompleted: true,
}

const incompleteUser: SafeSessionDto = {
  id: 'incomplete-user',
  displayName: 'Incomplete User',
  avatarKey: 'avatar-incomplete',
  onboardingCompleted: false,
}

const dashboardShell = {
  dashboards: [{ id: 'home-dashboard', name: 'Home', sortOrder: 0, isHome: true }],
  activeDashboardId: 'home-dashboard',
  activeDashboard: { id: 'home-dashboard', name: 'Home', sortOrder: 0, isHome: true },
}

const resetSessionState = () => {
  useState<SafeSessionDto | null>('kunai.safe-session', () => null).value = null
  useState<SessionValidationState>('kunai.session-validation-state', () => 'idle').value = 'idle'
  useState<string>('kunai.session-validation-message', () => '').value = ''
  useState<number>('kunai.session-request-epoch', () => 0).value = 0
}

const fillLoginForm = async (wrapper: Awaited<ReturnType<typeof mountSuspended>>) => {
  await wrapper.get('[data-testid="login-email"]').setValue('user@example.test')
  await wrapper.get('[data-testid="login-password"]').setValue('correct-password')
}

const settleAsyncUi = async () => {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetSessionState()
  document.documentElement.removeAttribute('data-theme')
})

describe('login page', () => {
  it('renders a real accessible login form without protected data', async () => {
    resetSessionState()

    const wrapper = await mountSuspended(App, { route: '/login' })

    expect(wrapper.get('main[aria-labelledby="login-heading"]').text()).toContain('Login')
    expect(wrapper.get('label[for="login-email"]').text()).toContain('Email')
    expect(wrapper.get('[data-testid="login-email"]').attributes('type')).toBe('email')
    expect(wrapper.get('label[for="login-password"]').text()).toContain('Password')
    expect(wrapper.get('[data-testid="login-password"]').attributes('type')).toBe('password')
    expect(wrapper.get('[data-testid="login-submit"]').text()).toBe('Sign in')
    expect(wrapper.html()).not.toContain('kunai_session')
    expect(wrapper.html()).not.toContain('PocketBase')

    wrapper.unmount()
  })

  it('posts credentials through the existing session mechanism for completed users', async () => {
    resetSessionState()
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/login') return Promise.resolve({ session: completedUser })
      if (path === '/api/dashboards') return Promise.resolve(dashboardShell)
      return Promise.reject(new Error(`Unexpected request: ${path}`))
    })
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = await mountSuspended(App, { route: '/login' })
    await fillLoginForm(wrapper)
    await wrapper.get('form').trigger('submit')
    await settleAsyncUi()

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: { email: 'user@example.test', password: 'correct-password' },
    })
    expect(useState<SafeSessionDto | null>('kunai.safe-session', () => null).value).toEqual(completedUser)
    expect(useState<SafeSessionDto | null>('kunai.safe-session', () => null).value?.onboardingCompleted).toBe(true)

    wrapper.unmount()
  })

  it('stores incomplete users so the existing auth routing can send them to onboarding', async () => {
    resetSessionState()
    vi.stubGlobal('$fetch', vi.fn((path: string) => {
      if (path === '/api/auth/login') return Promise.resolve({ session: incompleteUser })
      return Promise.reject(new Error(`Unexpected request: ${path}`))
    }))

    const wrapper = await mountSuspended(App, { route: '/login' })
    await fillLoginForm(wrapper)
    await wrapper.get('form').trigger('submit')
    await settleAsyncUi()

    expect(useState<SafeSessionDto | null>('kunai.safe-session', () => null).value).toEqual(incompleteUser)
    expect(useState<SafeSessionDto | null>('kunai.safe-session', () => null).value?.onboardingCompleted).toBe(false)

    wrapper.unmount()
  })

  it('shows loading state while login is pending', async () => {
    resetSessionState()
    const pending = Promise.withResolvers<{ session: SafeSessionDto }>()
    vi.stubGlobal('$fetch', vi.fn((path: string) => {
      if (path === '/api/auth/login') return pending.promise
      return Promise.reject(new Error(`Unexpected request: ${path}`))
    }))

    const wrapper = await mountSuspended(App, { route: '/login' })
    await fillLoginForm(wrapper)
    await wrapper.get('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="login-submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="login-submit"]').text()).toBe('Signing in…')
    expect(wrapper.text()).toContain('Authenticating…')

    pending.resolve({ session: completedUser })
    await settleAsyncUi()
    wrapper.unmount()
  })

  it('shows sanitized errors for invalid credentials and outages', async () => {
    resetSessionState()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce({ statusCode: 401, data: { message: 'raw PocketBase token secret' } })
      .mockRejectedValueOnce({ statusCode: 503, data: { message: 'database host detail' } })
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = await mountSuspended(App, { route: '/login' })
    await fillLoginForm(wrapper)
    await wrapper.get('form').trigger('submit')
    await settleAsyncUi()

    expect(wrapper.get('[data-testid="login-error"]').text()).toBe('Invalid email or password')
    expect(wrapper.html()).not.toContain('raw PocketBase token secret')

    await wrapper.get('[data-testid="login-password"]').setValue('correct-password')
    await wrapper.get('form').trigger('submit')
    await settleAsyncUi()

    expect(wrapper.text()).toContain('Login is temporarily unavailable')
    expect(wrapper.html()).not.toContain('database host detail')

    wrapper.unmount()
  })
})
