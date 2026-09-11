import { defineEventHandler, getHeader, setResponseStatus } from 'h3'

import { apiErrorBody, toApiError, ApiError } from '../../utils/api-error'
import { getRuntimeConfig } from '../../utils/runtime-config'
import { h3CookieController, h3HeaderReader } from '../../utils/h3-adapters'
import { logoutSession } from '../../utils/session'
import { validateSameOrigin } from '../../utils/same-origin'

export default defineEventHandler(async (event) => {
  try {
    const runtimeConfig = getRuntimeConfig(event)
    validateSameOrigin(h3HeaderReader(event), runtimeConfig)
    const contentType = getHeader(event, 'content-type') ?? ''
    if (contentType && !contentType.toLowerCase().includes('application/json')) {
      throw new ApiError(415, 'unsupported_media_type', 'Expected application/json.')
    }

    logoutSession({
      event,
      runtimeConfig,
      cookies: h3CookieController(event),
    })
    setResponseStatus(event, 204)
    return null
  } catch (error) {
    const apiError = toApiError(error)
    setResponseStatus(event, apiError.statusCode)
    return apiErrorBody(apiError)
  }
})
