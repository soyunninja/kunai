import { defineEventHandler, setResponseHeader, setResponseStatus } from 'h3'

import { apiErrorBody, toApiError } from '../../utils/api-error'
import { h3CookieController } from '../../utils/h3-adapters'
import { loadOnboardingDraft } from '../../utils/onboarding'
import { getRuntimeConfig } from '../../utils/runtime-config'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  try {
    const envelope = await loadOnboardingDraft({
      event,
      runtimeConfig: getRuntimeConfig(event),
      cookies: h3CookieController(event),
    })
    return envelope
  } catch (error) {
    const apiError = toApiError(error)
    setResponseStatus(event, apiError.statusCode)
    return apiErrorBody(apiError)
  }
})
