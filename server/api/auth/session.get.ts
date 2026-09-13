import { defineEventHandler, setResponseHeader, setResponseStatus } from 'h3'

import { apiErrorBody, toApiError } from '../../utils/api-error'
import { getRuntimeConfig } from '../../utils/runtime-config'
import { h3CookieController } from '../../utils/h3-adapters'
import { resolveSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  try {
    return await resolveSession({
      event,
      runtimeConfig: getRuntimeConfig(event),
      cookies: h3CookieController(event),
    })
  } catch (error) {
    const apiError = toApiError(error)
    setResponseStatus(event, apiError.statusCode)
    return apiErrorBody(apiError)
  }
})
