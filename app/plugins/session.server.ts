import { setResponseHeader, setResponseStatus } from 'h3'
import { defineNuxtPlugin, useRequestEvent, useRuntimeConfig, useState } from '#imports'

import type { SafeSessionDto } from '../../shared/types/auth'
import { ApiError } from '../../server/utils/api-error'
import { h3CookieController } from '../../server/utils/h3-adapters'
import { resolveSession } from '../../server/utils/session'
import type { SessionValidationState } from '../composables/useSession'

export default defineNuxtPlugin(async () => {
  const event = useRequestEvent()
  if (!event) {
    return
  }

  const session = useState<SafeSessionDto | null>('kunai.safe-session', () => null)
  const validationState = useState<SessionValidationState>('kunai.session-validation-state', () => 'idle')
  const validationMessage = useState<string>('kunai.session-validation-message', () => '')

  try {
    const envelope = await resolveSession({
      event,
      runtimeConfig: useRuntimeConfig(event),
      cookies: h3CookieController(event),
    })

    session.value = envelope.session
    validationState.value = 'ready'
    validationMessage.value = ''

    if (envelope.session) {
      setResponseHeader(event, 'Cache-Control', 'private, no-store')
    }
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 503) {
      session.value = null
      validationState.value = 'unavailable'
      validationMessage.value = error.message
      setResponseStatus(event, 503)
      setResponseHeader(event, 'Cache-Control', 'private, no-store')
      return
    }

    throw error
  }
})
