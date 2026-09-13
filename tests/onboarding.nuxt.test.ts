import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { useState } from '#imports'

import App from '../app/app.vue'
import type { SessionValidationState } from '../app/composables/useSession'
import type { SafeSessionDto } from '../shared/types/auth'
import { AVATAR_REGISTRY } from '../shared/avatars'

const incompleteUser: SafeSessionDto = {
  id: 'onboarding-user',
  displayName: '',
  avatarKey: '',
  onboardingCompleted: false,
}

const emptyDraft = {
  draft: {
    displayName: '',
    avatarKey: '',
    timezone: '',
    defaultLocation: null,
  },
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

const mountOnboarding = async () => {
  setSessionState(incompleteUser)
  const wrapper = await mountSuspended(App, { route: '/onboarding' })
  await flushPromises()
  return wrapper
}

const installTimezone = (timeZone: string | undefined) => {
  const original = Intl.DateTimeFormat
  const dateTimeFormat = vi.fn(() => ({
    resolvedOptions: () => timeZone === undefined ? {} : { timeZone },
  }))
  vi.stubGlobal('Intl', {
    ...Intl,
    DateTimeFormat: dateTimeFormat,
  })
  return original
}

const installGeolocation = (implementation: PositionErrorCallback | null = vi.fn()) => {
  const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((success, error) => {
    if (implementation === null) return
    implementation({ code: 1, message: 'Denied by test harness', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
    error?.({ code: 1, message: 'Denied by test harness', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
  })
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  })
  return getCurrentPosition
}

const setSecureContext = (value: boolean) => {
  Object.defineProperty(globalThis.window, 'isSecureContext', {
    configurable: true,
    value,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setSessionState(null)
  document.documentElement.removeAttribute('data-theme')
})

describe('Checkpoint 4B onboarding visual RED contract', () => {
  beforeEach(() => {
    setSecureContext(true)
    vi.stubGlobal('$fetch', vi.fn(async (path: string) => {
      if (path === '/api/onboarding') return emptyDraft
      throw new Error(`Unexpected request: ${path}`)
    }))
  })

  it('requires one of the ten real bundled avatars before completion', async () => {
    const wrapper = await mountOnboarding()

    const avatarOptions = wrapper.findAll('[data-testid^="avatar-option-"]')
    expect(avatarOptions).toHaveLength(AVATAR_REGISTRY.length)
    expect(AVATAR_REGISTRY.map((entry) => entry.key)).toEqual([
      'avatar-01',
      'avatar-02',
      'avatar-03',
      'avatar-04',
      'avatar-05',
      'avatar-06',
      'avatar-07',
      'avatar-08',
      'avatar-09',
      'avatar-10',
    ])

    for (const avatar of AVATAR_REGISTRY) {
      const option = wrapper.get(`[data-testid="avatar-option-${avatar.key}"]`)
      expect(option.attributes('role')).toBe('radio')
      expect(option.text()).toContain(avatar.label)
      expect(option.find(`img[src="${avatar.src}"]`).exists()).toBe(true)
    }

    await wrapper.get('[data-testid="onboarding-submit"]').trigger('click')
    expect(wrapper.get('[data-testid="avatar-error"]').text()).toMatch(/avatar/i)
    wrapper.unmount()
  })

  it('detects browser timezone client-side and never falls back silently to UTC', async () => {
    installTimezone('Europe/Madrid')
    const wrapper = await mountOnboarding()

    const timezone = wrapper.get<HTMLInputElement>('[data-testid="timezone-input"]')
    expect(timezone.element.value).toBe('Europe/Madrid')

    vi.unstubAllGlobals()
    installTimezone(undefined)
    const missingTimezoneWrapper = await mountOnboarding()
    expect(missingTimezoneWrapper.get<HTMLInputElement>('[data-testid="timezone-input"]').element.value).toBe('')
    expect(missingTimezoneWrapper.text()).not.toContain('UTC')

    wrapper.unmount()
    missingTimezoneWrapper.unmount()
  })

  it('allows manual timezone correction before submit', async () => {
    installTimezone('Europe/Madrid')
    const wrapper = await mountOnboarding()

    const timezone = wrapper.get<HTMLInputElement>('[data-testid="timezone-input"]')
    await timezone.setValue('Asia/Tokyo')

    expect(timezone.element.value).toBe('Asia/Tokyo')
    wrapper.unmount()
  })

  it('loads a persisted draft without overwriting its timezone and submits only the approved DTO', async () => {
    installTimezone('Asia/Tokyo')
    const finalSession: SafeSessionDto = {
      id: 'onboarding-user',
      displayName: 'Ada',
      avatarKey: 'avatar-02',
      onboardingCompleted: true,
    }
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/onboarding') {
        return {
          draft: {
            displayName: 'Ada',
            avatarKey: 'avatar-02',
            timezone: 'Europe/Madrid',
            defaultLocation: { kind: 'label', label: 'Madrid' },
          },
        }
      }
      return { session: finalSession }
    })
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = await mountOnboarding()

    expect(wrapper.get<HTMLInputElement>('[data-testid="timezone-input"]').element.value).toBe('Europe/Madrid')
    await wrapper.get('[data-testid="onboarding-submit"]').trigger('click')

    const completionCall = fetchMock.mock.calls.find(([path]) => path === '/api/onboarding/complete')
    expect(completionCall).toEqual([
      '/api/onboarding/complete',
      {
        method: 'POST',
        body: {
          displayName: 'Ada',
          avatarKey: 'avatar-02',
          timezone: 'Europe/Madrid',
          defaultLocation: { kind: 'label', label: 'Madrid' },
        },
      },
    ])
    expect(useState<SafeSessionDto | null>('kunai.safe-session', () => null).value).toEqual(finalSession)
    wrapper.unmount()
  })

  it('does not request geolocation on load and requests it only after explicit user action', async () => {
    const getCurrentPosition = installGeolocation(null)
    const wrapper = await mountOnboarding()

    expect(getCurrentPosition).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="detect-location"]').trigger('click')
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('requires a secure browser context before offering geolocation detection', async () => {
    setSecureContext(false)
    const getCurrentPosition = installGeolocation(null)
    const wrapper = await mountOnboarding()

    await wrapper.get('[data-testid="detect-location"]').trigger('click')

    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="location-status"]').text()).toMatch(/secure context/i)
    wrapper.unmount()
  })

  it.each([
    ['permission denied', { code: 1, message: 'Permission denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }, /denied/i],
    ['timeout', { code: 3, message: 'Timed out', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }, /timed out|timeout/i],
    ['unavailable', { code: 2, message: 'Unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }, /unavailable/i],
    ['failure', { code: 0, message: 'Unexpected failure', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }, /failed|failure/i],
  ] satisfies readonly [string, GeolocationPositionError, RegExp][])('treats geolocation %s as recoverable and keeps location optional', async (_label, error, message) => {
    const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((_success, reject) => reject?.(error))
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })
    const wrapper = await mountOnboarding()

    await wrapper.get('[data-testid="detect-location"]').trigger('click')

    expect(wrapper.get('[data-testid="location-status"]').text()).toMatch(message)
    expect(wrapper.get('[data-testid="location-optional-note"]').text()).toMatch(/optional/i)
    expect(wrapper.find('[data-testid="latitude-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="longitude-input"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('supports skip and clear location with a non-geocoded manual label', async () => {
    const wrapper = await mountOnboarding()

    await wrapper.get<HTMLInputElement>('[data-testid="location-label-input"]').setValue('Tokyo')
    expect(wrapper.get('[data-testid="location-label-kind"]').text()).toMatch(/non-geocoded/i)

    await wrapper.get('[data-testid="skip-location"]').trigger('click')
    expect(wrapper.get<HTMLInputElement>('[data-testid="location-label-input"]').element.value).toBe('')
    expect(wrapper.get('[data-testid="location-summary"]').text()).toMatch(/unconfigured/i)

    await wrapper.get<HTMLInputElement>('[data-testid="location-label-input"]').setValue('Madrid')
    await wrapper.get('[data-testid="clear-location"]').trigger('click')
    expect(wrapper.get<HTMLInputElement>('[data-testid="location-label-input"]').element.value).toBe('')
    wrapper.unmount()
  })

  it('preserves form data after a recoverable completion error and allows retry with loading feedback', async () => {
    const completionMock = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('temporary'), { statusCode: 503 }))
      .mockResolvedValueOnce({ session: { id: 'onboarding-user', displayName: 'Ada', avatarKey: 'avatar-01', onboardingCompleted: true } })
    const fetchMock = vi.fn((path: string) => path === '/api/onboarding' ? Promise.resolve(emptyDraft) : completionMock())
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = await mountOnboarding()

    await wrapper.get<HTMLInputElement>('[data-testid="display-name-input"]').setValue('Ada')
    await wrapper.get('[data-testid="avatar-option-avatar-01"]').trigger('click')
    await wrapper.get<HTMLInputElement>('[data-testid="timezone-input"]').setValue('Europe/Madrid')
    await wrapper.get<HTMLInputElement>('[data-testid="location-label-input"]').setValue('Madrid')
    await wrapper.get('[data-testid="onboarding-submit"]').trigger('click')

    expect(wrapper.get('[data-testid="onboarding-loading"]').text()).toMatch(/saving|loading/i)
    expect(wrapper.get('[data-testid="onboarding-error"]').text()).toMatch(/retry/i)
    expect(wrapper.get<HTMLInputElement>('[data-testid="display-name-input"]').element.value).toBe('Ada')
    expect(wrapper.get<HTMLInputElement>('[data-testid="timezone-input"]').element.value).toBe('Europe/Madrid')
    expect(wrapper.get<HTMLInputElement>('[data-testid="location-label-input"]').element.value).toBe('Madrid')

    await wrapper.get('[data-testid="onboarding-retry"]').trigger('click')
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/onboarding/complete')).toHaveLength(2)
    wrapper.unmount()
  })

  it('is keyboard-operable and exposes tablet/touch-sized controls', async () => {
    const wrapper = await mountOnboarding()

    const firstAvatar = wrapper.get('[data-testid="avatar-option-avatar-01"]')
    await firstAvatar.trigger('keydown', { key: 'Enter' })
    expect(firstAvatar.attributes('aria-checked')).toBe('true')

    const controls = [
      ...wrapper.findAll('[data-testid^="avatar-option-"]'),
      wrapper.get('[data-testid="detect-location"]'),
      wrapper.get('[data-testid="skip-location"]'),
      wrapper.get('[data-testid="onboarding-submit"]'),
    ]
    for (const control of controls) {
      expect(control.attributes('class') ?? '').toMatch(/touch-target|min-h-11|min-h-12/)
    }
    wrapper.unmount()
  })
})
