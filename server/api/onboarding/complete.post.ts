import { defineEventHandler, getHeader, readBody, setResponseHeader, setResponseStatus } from 'h3'

import { avatarKeyAllowlist } from '../../../shared/avatars'
import { parseOnboardingCompletionInput } from '../../../shared/validation/onboarding'
import { apiErrorBody, ApiError, toOnboardingApiError } from '../../utils/api-error'
import { h3CookieController, h3HeaderReader } from '../../utils/h3-adapters'
import { completeOnboarding } from '../../utils/onboarding'
import { getRequestPocketBase } from '../../utils/pocketbase-client'
import { getRuntimeConfig } from '../../utils/runtime-config'
import { clearSessionCookie, resolveSession } from '../../utils/session'
import { validateSameOrigin } from '../../utils/same-origin'

const parseCompletionBody = (body: unknown) => {
  try {
    return parseOnboardingCompletionInput(body, { allowedAvatarKeys: avatarKeyAllowlist() })
  } catch {
    throw new ApiError(400, 'invalid_onboarding_input', 'Onboarding details are invalid.')
  }
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = getRuntimeConfig(event)
  const cookies = h3CookieController(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  try {
    validateSameOrigin(h3HeaderReader(event), runtimeConfig)
    if (!(getHeader(event, 'content-type') ?? '').toLowerCase().includes('application/json')) {
      throw new ApiError(415, 'unsupported_media_type', 'Expected application/json.')
    }

    const { session } = await resolveSession({ event, runtimeConfig, cookies })
    if (!session) throw new ApiError(401, 'unauthenticated', 'Authentication is required.')
    if (session.onboardingCompleted) throw new ApiError(409, 'onboarding_already_completed', 'Onboarding has already been completed.')

    const input = parseCompletionBody(await readBody(event))
    const pb = getRequestPocketBase(event, runtimeConfig, event.context.pocketBaseAuthToken)
    const result = await completeOnboarding({ pb, ownerId: session.id, ...input })

    return { session: result.session }
  } catch (error) {
    const apiError = toOnboardingApiError(error)
    if (apiError.code === 'unauthenticated') {
      clearSessionCookie({ event, runtimeConfig, cookies })
    }
    setResponseStatus(event, apiError.statusCode)
    return apiErrorBody(apiError)
  }
})
