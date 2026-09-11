import { defineEventHandler, getHeader, readBody, setResponseStatus } from 'h3'

import { apiErrorBody, toApiError, ApiError } from '../../utils/api-error'
import { getRuntimeConfig } from '../../utils/runtime-config'
import { h3CookieController, h3HeaderReader } from '../../utils/h3-adapters'
import { loginWithPassword } from '../../utils/session'
import { validateSameOrigin } from '../../utils/same-origin'

const parseLoginBody = (body: unknown): { email: string, password: string } => {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'invalid_request', 'Invalid login request.')
  }

  const candidate = body as { email?: unknown, password?: unknown }
  if (typeof candidate.email !== 'string' || typeof candidate.password !== 'string') {
    throw new ApiError(400, 'invalid_request', 'Invalid login request.')
  }

  return { email: candidate.email, password: candidate.password }
}

export default defineEventHandler(async (event) => {
  try {
    const runtimeConfig = getRuntimeConfig(event)
    validateSameOrigin(h3HeaderReader(event), runtimeConfig)
    const contentType = getHeader(event, 'content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new ApiError(415, 'unsupported_media_type', 'Expected application/json.')
    }

    const body = parseLoginBody(await readBody(event))
    return await loginWithPassword({
      event,
      runtimeConfig,
      cookies: h3CookieController(event),
    }, body)
  } catch (error) {
    const apiError = toApiError(error)
    setResponseStatus(event, apiError.statusCode)
    return apiErrorBody(apiError)
  }
})
