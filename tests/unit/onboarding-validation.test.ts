import { describe, expect, it } from 'vitest'

import {
  createInitialWidgetConfig,
  parseOnboardingCompletionInput,
} from '../../shared/validation/onboarding'
import type { OnboardingCompletionInput } from '../../shared/types/onboarding'

const fixtureAvatarKeys = ['fixture-avatar-a', 'fixture-avatar-b'] as const

const validInput = {
  displayName: 'Ada Lovelace',
  avatarKey: 'fixture-avatar-a',
  timezone: 'Europe/Madrid',
  defaultLocation: null,
} satisfies OnboardingCompletionInput

const parseValidInput = (input: unknown = validInput) => parseOnboardingCompletionInput(input, {
  allowedAvatarKeys: fixtureAvatarKeys,
})

describe('onboarding completion input validation', () => {
  it('accepts a bounded display name, fixture avatar key, IANA timezone, and null default location', () => {
    expect(parseValidInput()).toEqual(validInput)
  })

  it('trims displayName without accepting an empty or whitespace-only name', () => {
    expect(parseValidInput({ ...validInput, displayName: '  Grace Hopper  ' })).toEqual({
      ...validInput,
      displayName: 'Grace Hopper',
    })

    expect(() => parseValidInput({ ...validInput, displayName: '' })).toThrow(/displayName/i)
    expect(() => parseValidInput({ ...validInput, displayName: '   ' })).toThrow(/displayName/i)
  })

  it('rejects displayName values outside the persisted profile bounds', () => {
    expect(() => parseValidInput({ ...validInput, displayName: 'a'.repeat(81) })).toThrow(/displayName/i)
    expect(() => parseValidInput({ ...validInput, displayName: 123 })).toThrow(/displayName/i)
  })

  it('accepts only fixture avatar keys supplied to the validator and never assumes product assets', () => {
    expect(parseValidInput({ ...validInput, avatarKey: 'fixture-avatar-b' })).toEqual({
      ...validInput,
      avatarKey: 'fixture-avatar-b',
    })

    expect(() => parseValidInput({ ...validInput, avatarKey: 'fixture-avatar-c' })).toThrow(/avatarKey/i)
    expect(() => parseValidInput({ ...validInput, avatarKey: '' })).toThrow(/avatarKey/i)
  })

  it('accepts generated IANA timezones without hidden fallback behavior', () => {
    expect(parseValidInput({ ...validInput, timezone: 'Asia/Tokyo' })).toEqual({
      ...validInput,
      timezone: 'Asia/Tokyo',
    })

    expect(parseValidInput({ ...validInput, timezone: 'America/New_York' })).toEqual({
      ...validInput,
      timezone: 'America/New_York',
    })

    expect(() => parseValidInput({ ...validInput, timezone: '' })).toThrow(/timezone/i)
    expect(() => parseValidInput({ ...validInput, timezone: 'Mars/Olympus_Mons' })).toThrow(/timezone/i)
  })

  it('accepts defaultLocation as explicitly unconfigured null', () => {
    expect(parseValidInput({ ...validInput, defaultLocation: null })).toEqual({
      ...validInput,
      defaultLocation: null,
    })
  })

  it('accepts a non-geocoded location label without coordinates or provider metadata', () => {
    expect(parseValidInput({
      ...validInput,
      defaultLocation: {
        kind: 'label',
        label: 'Madrid',
      },
    })).toEqual({
      ...validInput,
      defaultLocation: {
        kind: 'label',
        label: 'Madrid',
      },
    })
  })

  it('accepts manual coordinates without geocoder or weather-provider fields', () => {
    expect(parseValidInput({
      ...validInput,
      defaultLocation: {
        kind: 'coordinates',
        label: 'Tokyo',
        latitude: 35.6762,
        longitude: 139.6503,
      },
    })).toEqual({
      ...validInput,
      defaultLocation: {
        kind: 'coordinates',
        label: 'Tokyo',
        latitude: 35.6762,
        longitude: 139.6503,
      },
    })
  })

  it('applies the persisted 120-character defaultLocation label boundary before persistence', () => {
    const boundaryLabel = 'a'.repeat(120)
    const tooLongLabel = 'a'.repeat(121)

    expect(parseValidInput({
      ...validInput,
      defaultLocation: { kind: 'label', label: boundaryLabel },
    }).defaultLocation).toEqual({ kind: 'label', label: boundaryLabel })

    expect(parseValidInput({
      ...validInput,
      defaultLocation: { kind: 'coordinates', label: boundaryLabel, latitude: 0, longitude: 0 },
    }).defaultLocation).toEqual({ kind: 'coordinates', label: boundaryLabel, latitude: 0, longitude: 0 })

    expect(() => parseValidInput({
      ...validInput,
      defaultLocation: { kind: 'label', label: tooLongLabel },
    })).toThrow(/120 characters/i)

    expect(() => parseValidInput({
      ...validInput,
      defaultLocation: { kind: 'coordinates', label: tooLongLabel, latitude: 0, longitude: 0 },
    })).toThrow(/120 characters/i)
  })

  it('rejects invalid or incomplete location payloads', () => {
    expect(() => parseValidInput({ ...validInput, defaultLocation: undefined })).toThrow(/defaultLocation/i)
    expect(() => parseValidInput({ ...validInput, defaultLocation: { kind: 'label', label: '' } })).toThrow(/defaultLocation/i)
    expect(() => parseValidInput({ ...validInput, defaultLocation: { kind: 'coordinates', label: 'Bad', latitude: 91, longitude: 0 } })).toThrow(/latitude/i)
    expect(() => parseValidInput({ ...validInput, defaultLocation: { kind: 'coordinates', label: 'Bad', latitude: 0, longitude: 181 } })).toThrow(/longitude/i)
    expect(() => parseValidInput({ ...validInput, defaultLocation: { kind: 'coordinates', latitude: 0, longitude: 0 } })).toThrow(/defaultLocation/i)
    expect(() => parseValidInput({ ...validInput, defaultLocation: { kind: 'geocoded', label: 'Madrid', provider: 'example' } })).toThrow(/defaultLocation/i)
  })

  it('rejects unknown top-level fields and unknown nested location fields', () => {
    expect(() => parseValidInput({ ...validInput, role: 'admin' })).toThrow(/unknown/i)
    expect(() => parseValidInput({
      ...validInput,
      defaultLocation: {
        kind: 'label',
        label: 'Madrid',
        provider: 'not-allowed',
      },
    })).toThrow(/unknown/i)
  })

  it('rejects malformed JSON-shaped values instead of applying defaults', () => {
    expect(() => parseValidInput(null)).toThrow(/object/i)
    expect(() => parseValidInput([])).toThrow(/object/i)
    expect(() => parseValidInput('not-json')).toThrow(/object/i)
  })
})

describe('initial Home widget config validation contract', () => {
  it('creates final persisted Search and Bookmarks config payloads', () => {
    expect(createInitialWidgetConfig('search')).toEqual({ engine: 'google', placeholder: null })
    expect(createInitialWidgetConfig('bookmarks')).toEqual({ items: [] })
  })

  it('creates final persisted Clock config with a valid timezone', () => {
    expect(createInitialWidgetConfig('clock', { timezone: 'Europe/Madrid' })).toEqual({
      mode: 'local',
      timezone: 'Europe/Madrid',
    })
  })

  it('rejects Clock config without a valid timezone', () => {
    expect(() => createInitialWidgetConfig('clock', { timezone: 'Not/AZone' })).toThrow(/timezone/i)
  })

  it('creates final persisted Weather config with the submitted defaultLocation', () => {
    const location = { kind: 'label', label: 'Madrid' } as const
    expect(createInitialWidgetConfig('weather', { defaultLocation: location })).toEqual({ location })
    expect(createInitialWidgetConfig('weather', { defaultLocation: null })).toEqual({ location: null })
  })

  it('rejects Weather config with an invalid defaultLocation', () => {
    expect(() => createInitialWidgetConfig('weather', { defaultLocation: { kind: 'label', label: '' } })).toThrow(/label/i)
  })

  it('does not create provider-backed or functional widget configuration during onboarding validation', () => {
    expect(createInitialWidgetConfig('weather', { defaultLocation: null })).not.toHaveProperty('provider')
    expect(createInitialWidgetConfig('search')).not.toHaveProperty('apiKey')
    expect(createInitialWidgetConfig('bookmarks')).not.toHaveProperty('source')
  })
})
