import { computed, ref } from 'vue'
import { navigateTo } from '#imports'

import { AVATAR_REGISTRY, isApprovedAvatarKey } from '~~/shared/avatars'
import { IANA_TIMEZONES } from '~~/shared/generated/timezones'
import type { SafeSessionDto } from '~~/shared/types/auth'
import type { DefaultLocation, OnboardingDraft, OnboardingDraftEnvelope } from '~~/shared/types/onboarding'
import { parseDefaultLocation, parseOnboardingCompletionInput } from '~~/shared/validation/onboarding'
import { useSession } from './useSession'

const ianaTimezoneSet = new Set<string>(IANA_TIMEZONES)

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isDraftEnvelope = (value: unknown): value is OnboardingDraftEnvelope => {
  if (!isPlainObject(value) || !isPlainObject(value.draft)) return false

  const { draft } = value
  if (typeof draft.displayName !== 'string' || typeof draft.avatarKey !== 'string' || typeof draft.timezone !== 'string') {
    return false
  }

  try {
    parseDefaultLocation(draft.defaultLocation)
    return true
  } catch {
    return false
  }
}

const isSafeSession = (value: unknown): value is SafeSessionDto => (
  isPlainObject(value)
  && typeof value.id === 'string'
  && typeof value.displayName === 'string'
  && typeof value.avatarKey === 'string'
  && typeof value.onboardingCompleted === 'boolean'
)

const errorCode = (error: unknown): string | undefined => (
  isPlainObject(error)
  && isPlainObject(error.data)
  && isPlainObject(error.data.error)
  && typeof error.data.error.code === 'string'
    ? error.data.error.code
    : undefined
)

const errorFields = (error: unknown): Record<string, string> | undefined => (
  isPlainObject(error)
  && isPlainObject(error.data)
  && isPlainObject(error.data.error)
  && isPlainObject(error.data.error.fields)
    ? Object.fromEntries(Object.entries(error.data.error.fields).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : undefined
)

const completionMessage = (code: string | undefined): string => {
  switch (code) {
    case 'seed_conflict':
      return 'Your initial workspace needs attention. Please retry shortly.'
    case 'onboarding_retry_exhausted':
      return 'Saving is still busy. Please retry.'
    case 'onboarding_unavailable':
      return 'Onboarding is temporarily unavailable. Please retry.'
    case 'response_lost':
      return 'The save result was interrupted. Please retry.'
    case 'unauthenticated':
      return 'Your session has expired. Please sign in again.'
    default:
      return 'We could not save onboarding details. Please retry.'
  }
}

export const useOnboarding = () => {
  const { completeOnboarding } = useSession()
  const displayName = ref('')
  const avatarKey = ref('')
  const timezone = ref('')
  const defaultLocation = ref<DefaultLocation>(null)
  const fieldErrors = ref<Record<string, string>>({})
  const status = ref('')
  const isLoadingDraft = ref(false)
  const isSubmitting = ref(false)
  const completed = ref(false)

  const locationLabel = computed({
    get: () => defaultLocation.value?.label ?? '',
    set: (value: string) => {
      const label = value.trim()
      defaultLocation.value = label ? { kind: 'label', label } : null
    },
  })

  const locationSummary = computed(() => {
    if (!defaultLocation.value) return 'Location is unconfigured.'
    return defaultLocation.value.kind === 'label'
      ? `Manual label: ${defaultLocation.value.label}`
      : 'Browser location detected.'
  })

  const assignDraft = (draft: OnboardingDraft) => {
    displayName.value = draft.displayName.trim().slice(0, 80)
    avatarKey.value = isApprovedAvatarKey(draft.avatarKey) ? draft.avatarKey : ''
    timezone.value = ianaTimezoneSet.has(draft.timezone) ? draft.timezone : ''
    defaultLocation.value = draft.defaultLocation

    if (draft.avatarKey && !avatarKey.value) {
      status.value = 'Your saved avatar is unavailable. Choose a bundled avatar.'
    }
    if (draft.timezone && !timezone.value) {
      fieldErrors.value = { ...fieldErrors.value, timezone: 'Enter a valid IANA timezone.' }
    }
  }

  const detectTimezoneIfMissing = () => {
    if (timezone.value || !import.meta.client) return

    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (typeof detected === 'string' && ianaTimezoneSet.has(detected)) {
      timezone.value = detected
    } else {
      fieldErrors.value = { ...fieldErrors.value, timezone: 'Timezone could not be detected. Enter a valid IANA timezone.' }
    }
  }

  const loadDraft = async () => {
    isLoadingDraft.value = true
    status.value = ''

    try {
      const response = await $fetch<unknown>('/api/onboarding')
      if (!isDraftEnvelope(response)) {
        status.value = 'Saved onboarding details could not be loaded. You can continue with this form.'
        return
      }
      assignDraft(response.draft)
    } catch {
      status.value = 'Saved onboarding details could not be loaded. You can continue with this form.'
    } finally {
      isLoadingDraft.value = false
      detectTimezoneIfMissing()
    }
  }

  const clearLocation = () => {
    defaultLocation.value = null
    status.value = 'Location is unconfigured. You can continue without it.'
  }

  const detectLocation = () => {
    status.value = ''
    if (!import.meta.client || !window.isSecureContext) {
      status.value = 'Location detection requires a secure context. You can enter an optional label instead.'
      return
    }
    if (!navigator.geolocation) {
      status.value = 'Location detection is unavailable. You can enter an optional label instead.'
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        defaultLocation.value = {
          kind: 'coordinates',
          label: 'Browser location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        status.value = 'Browser location detected.'
      },
      (error) => {
        switch (error.code) {
          case 1:
            status.value = 'Location permission was denied. You can continue without a location.'
            break
          case 2:
            status.value = 'Location is unavailable. You can continue without a location.'
            break
          case 3:
            status.value = 'Location detection timed out. You can continue without a location.'
            break
          default:
            status.value = 'Location detection failed. You can continue without a location.'
        }
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    )
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!displayName.value.trim()) {
      errors.displayName = 'Display name is required.'
    } else if (displayName.value.trim().length > 80) {
      errors.displayName = 'Display name must be at most 80 characters.'
    }
    if (!isApprovedAvatarKey(avatarKey.value)) {
      errors.avatarKey = 'Choose an approved avatar.'
    }
    if (!ianaTimezoneSet.has(timezone.value)) {
      errors.timezone = 'Enter a valid IANA timezone.'
    }
    try {
      parseDefaultLocation(defaultLocation.value)
    } catch {
      errors.defaultLocation = 'Location details are invalid.'
    }

    if (Object.keys(errors).length > 0) {
      fieldErrors.value = errors
      return false
    }

    try {
      const parsed = parseOnboardingCompletionInput({
        displayName: displayName.value,
        avatarKey: avatarKey.value,
        timezone: timezone.value,
        defaultLocation: defaultLocation.value,
      }, { allowedAvatarKeys: AVATAR_REGISTRY.map((avatar) => avatar.key) })

      displayName.value = parsed.displayName
      timezone.value = parsed.timezone
      defaultLocation.value = parsed.defaultLocation
      fieldErrors.value = {}
      return true
    } catch {
      fieldErrors.value = { defaultLocation: 'Onboarding details are invalid.' }
      return false
    }
  }

  const submit = async () => {
    if (isSubmitting.value || completed.value || !validate()) return

    isSubmitting.value = true
    status.value = ''
    try {
      const response = await $fetch<unknown>('/api/onboarding/complete', {
        method: 'POST',
        body: {
          displayName: displayName.value,
          avatarKey: avatarKey.value,
          timezone: timezone.value,
          defaultLocation: defaultLocation.value,
        },
      })
      if (!isPlainObject(response) || !isSafeSession(response.session) || !response.session.onboardingCompleted) {
        throw new Error('invalid_completion_response')
      }

      completeOnboarding(response.session)
      completed.value = true
      status.value = 'Onboarding complete. Opening Home.'
      await navigateTo('/')
    } catch (error) {
      fieldErrors.value = errorFields(error) ?? {}
      status.value = completionMessage(errorCode(error))
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    avatarKey,
    clearLocation,
    completed,
    defaultLocation,
    detectLocation,
    detectTimezoneIfMissing,
    displayName,
    fieldErrors,
    isLoadingDraft,
    isSubmitting,
    loadDraft,
    locationLabel,
    locationSummary,
    status,
    submit,
    timezone,
  }
}
