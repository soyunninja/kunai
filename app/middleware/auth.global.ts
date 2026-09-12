import { abortNavigation, createError, defineNuxtRouteMiddleware, navigateTo, setResponseStatus, useRequestEvent } from '#imports'
import { setResponseHeader } from 'h3'

import { decideAuthRoute, normalizeAuthRoutePath, type AuthRouteState } from '../utils/auth-routing'
import { useSession } from '../composables/useSession'

export default defineNuxtRouteMiddleware((to) => {
  const routePath = normalizeAuthRoutePath(to.path)
  if (!routePath) {
    return
  }

  const { session, validationState, validationMessage } = useSession()
  const state: AuthRouteState = validationState.value === 'unavailable'
    ? { kind: 'unavailable', message: validationMessage.value }
    : session.value
      ? { kind: 'authenticated', session: session.value }
      : { kind: 'anonymous' }

  const decision = decideAuthRoute(routePath, state)
  const event = useRequestEvent()

  if (event && decision.cacheControl) {
    setResponseHeader(event, 'Cache-Control', decision.cacheControl)
  }

  if (decision.status === 503) {
    if (event) {
      setResponseStatus(event, 503)
    }

    return abortNavigation(createError({
      statusCode: 503,
      statusMessage: validationMessage.value || 'Session could not be validated',
    }))
  }

  if (decision.status === 302 && decision.location) {
    return navigateTo(decision.location, { redirectCode: 302 })
  }
})
