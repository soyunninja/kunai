import { IANA_TIMEZONES } from '../generated/timezones'
import type {
  BookmarksInitialWidgetConfig,
  ClockInitialWidgetConfig,
  DefaultLocation,
  InitialWidgetConfig,
  OnboardingCompletionInput,
  OnboardingParserOptions,
  SearchInitialWidgetConfig,
  WeatherInitialWidgetConfig,
} from '../types/onboarding'

export type InitialWidgetType = 'search' | 'clock' | 'weather' | 'bookmarks'

const onboardingInputKeys = ['displayName', 'avatarKey', 'timezone', 'defaultLocation'] as const
const locationLabelKeys = ['kind', 'label'] as const
const locationCoordinatesKeys = ['kind', 'label', 'latitude', 'longitude'] as const
const defaultLocationLabelMaxLength = 120
const ianaTimezoneSet = new Set<string>(IANA_TIMEZONES)

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
)

const assertKnownKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  context: string,
): void => {
  const unknownKey = Object.keys(value).find((key) => !allowedKeys.includes(key))
  if (unknownKey) {
    throw new Error(`Unknown ${context} field: ${unknownKey}`)
  }
}

const parseDisplayName = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error('displayName must be a string')
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error('displayName is required')
  }

  if (trimmed.length > 80) {
    throw new Error('displayName must be at most 80 characters')
  }

  return trimmed
}

const parseAvatarKey = (value: unknown, options: OnboardingParserOptions): string => {
  if (typeof value !== 'string' || !value) {
    throw new Error('avatarKey is required')
  }

  if (!options.allowedAvatarKeys.includes(value)) {
    throw new Error('avatarKey is not approved')
  }

  return value
}

const parseTimezone = (value: unknown): string => {
  if (typeof value !== 'string' || !value) {
    throw new Error('timezone is required')
  }

  if (!ianaTimezoneSet.has(value)) {
    throw new Error('timezone must be a valid IANA timezone')
  }

  return value
}

const parseLocationLabel = (value: Record<string, unknown>): DefaultLocation => {
  assertKnownKeys(value, locationLabelKeys, 'defaultLocation')
  if (typeof value.label !== 'string' || !value.label.trim()) {
    throw new Error('defaultLocation label is required')
  }

  const label = value.label.trim()
  if (label.length > defaultLocationLabelMaxLength) {
    throw new Error('defaultLocation label must be at most 120 characters')
  }

  return {
    kind: 'label',
    label,
  }
}

const parseLocationCoordinates = (value: Record<string, unknown>): DefaultLocation => {
  assertKnownKeys(value, locationCoordinatesKeys, 'defaultLocation')
  if (typeof value.label !== 'string' || !value.label.trim()) {
    throw new Error('defaultLocation label is required')
  }

  const label = value.label.trim()
  if (label.length > defaultLocationLabelMaxLength) {
    throw new Error('defaultLocation label must be at most 120 characters')
  }

  if (typeof value.latitude !== 'number' || !Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90) {
    throw new Error('latitude must be between -90 and 90')
  }

  if (typeof value.longitude !== 'number' || !Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) {
    throw new Error('longitude must be between -180 and 180')
  }

  return {
    kind: 'coordinates',
    label,
    latitude: value.latitude,
    longitude: value.longitude,
  }
}

export const parseDefaultLocation = (value: unknown): DefaultLocation => {
  if (value === null) {
    return null
  }

  if (!isPlainObject(value)) {
    throw new Error('defaultLocation must be null or an object')
  }

  if (value.kind === 'label') {
    return parseLocationLabel(value)
  }

  if (value.kind === 'coordinates') {
    return parseLocationCoordinates(value)
  }

  throw new Error('defaultLocation kind is not supported')
}

export const parseOnboardingCompletionInput = (
  input: unknown,
  options: OnboardingParserOptions,
): OnboardingCompletionInput => {
  if (!isPlainObject(input)) {
    throw new Error('onboarding input must be an object')
  }

  assertKnownKeys(input, onboardingInputKeys, 'onboarding input')

  return {
    displayName: parseDisplayName(input.displayName),
    avatarKey: parseAvatarKey(input.avatarKey, options),
    timezone: parseTimezone(input.timezone),
    defaultLocation: parseDefaultLocation(input.defaultLocation),
  }
}

export function createInitialWidgetConfig(widgetType: 'search'): SearchInitialWidgetConfig
export function createInitialWidgetConfig(widgetType: 'clock', input: { readonly timezone: string }): ClockInitialWidgetConfig
export function createInitialWidgetConfig(widgetType: 'weather', input: { readonly defaultLocation: DefaultLocation }): WeatherInitialWidgetConfig
export function createInitialWidgetConfig(widgetType: 'bookmarks'): BookmarksInitialWidgetConfig
export function createInitialWidgetConfig(
  widgetType: InitialWidgetType,
  input?: { readonly timezone: string } | { readonly defaultLocation: DefaultLocation },
): InitialWidgetConfig {
  switch (widgetType) {
    case 'search':
      return { engine: 'google', placeholder: null }
    case 'clock': {
      if (!input || !('timezone' in input)) throw new Error('clock config requires a timezone')
      return { mode: 'local', timezone: parseTimezone(input.timezone) }
    }
    case 'weather': {
      if (!input || !('defaultLocation' in input)) throw new Error('weather config requires a defaultLocation')
      return { location: parseDefaultLocation(input.defaultLocation) }
    }
    case 'bookmarks':
      return { items: [] }
  }
}
