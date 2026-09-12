import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useState } from '#imports'

import App from '../../app/app.vue'
import type { SafeSessionDto } from '../../shared/types/auth'
import type { SessionValidationState } from '../../app/composables/useSession'

const incompleteUser: SafeSessionDto = {
  id: 'incomplete-user',
  displayName: 'Incomplete User',
  avatarKey: 'avatar-incomplete',
  onboardingCompleted: false,
}

const completedUser: SafeSessionDto = {
  id: 'completed-user',
  displayName: 'Completed User',
  avatarKey: 'avatar-complete',
  onboardingCompleted: true,
}

const setSessionState = (
  session: SafeSessionDto | null,
  validationState: SessionValidationState = 'ready',
  validationMessage = '',
) => {
  useState<SafeSessionDto | null>('kunai.safe-session', () => null).value = session
  useState<SessionValidationState>('kunai.session-validation-state', () => 'idle').value = validationState
  useState<string>('kunai.session-validation-message', () => '').value = validationMessage
}

const resetSessionState = () => {
  setSessionState(null, 'idle', '')
  useState<number>('kunai.session-request-epoch', () => 0).value = 0
}

afterEach(() => {
  resetSessionState()
  document.documentElement.removeAttribute('data-theme')
})

describe('auth middleware integration', () => {
  it('redirects anonymous protected navigation to login through the real middleware', async () => {
    resetSessionState()

    const wrapper = await mountSuspended(App, { route: '/' })

    expect(wrapper.html()).toContain('Login')
    expect(wrapper.html()).not.toContain('Home')
    expect(wrapper.html()).not.toContain('Onboarding')
    wrapper.unmount()
  })

  it('redirects incomplete users from Home to onboarding through the real middleware', async () => {
    setSessionState(incompleteUser)

    const wrapper = await mountSuspended(App, { route: '/' })

    expect(wrapper.html()).toContain('Onboarding')
    expect(wrapper.html()).toContain('Incomplete User')
    expect(wrapper.html()).not.toContain('Home')
    wrapper.unmount()
  })

  it('renders completed users on Home through the real middleware', async () => {
    setSessionState(completedUser)

    const wrapper = await mountSuspended(App, { route: '/' })

    expect(wrapper.html()).toContain('Home')
    expect(wrapper.html()).toContain('Completed User')
    expect(wrapper.html()).not.toContain('Onboarding')
    wrapper.unmount()
  })

  it('blocks unavailable protected navigation before protected pages render', async () => {
    setSessionState(null, 'unavailable', 'Session could not be validated')

    const wrapper = await mountSuspended(App, { route: '/' })

    expect(wrapper.html()).toContain('Session could not be validated')
    expect(wrapper.html()).not.toContain('Home')
    expect(wrapper.html()).not.toContain('Completed User')
    expect(wrapper.html()).not.toContain('Incomplete User')
    wrapper.unmount()
  })
})
