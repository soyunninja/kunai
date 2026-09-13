import { defineEventHandler, setResponseHeader, setResponseStatus } from 'h3'

import { apiErrorBody, ApiError, toApiError } from '../utils/api-error'
import { h3CookieController } from '../utils/h3-adapters'
import { getRequestPocketBase } from '../utils/pocketbase-client'
import { getRuntimeConfig } from '../utils/runtime-config'
import { resolveSession } from '../utils/session'

interface MinimalHomeDto {
  readonly dashboard: {
    readonly id: string
    readonly name: 'Home'
  }
  readonly initialized: true
}

const hasStatus = (error: unknown, status: number): boolean => (
  typeof error === 'object'
  && error !== null
  && 'status' in error
  && error.status === status
)

const stringField = (record: Record<string, unknown>, field: string): string => (
  typeof record[field] === 'string' ? record[field] : ''
)

const filterValue = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const assertValidHomeSeed = (record: Record<string, unknown>, ownerId: string): MinimalHomeDto => {
  const id = stringField(record, 'id')
  const owner = stringField(record, 'owner')
  const seedKey = stringField(record, 'seedKey')
  const name = stringField(record, 'name')
  const sortOrder = typeof record.sortOrder === 'number' ? record.sortOrder : Number.NaN

  if (!id || owner !== ownerId || seedKey !== 'home' || name !== 'Home' || sortOrder !== 0) {
    throw new ApiError(409, 'home_inconsistent', 'Initial landing is not initialized correctly.')
  }

  return {
    dashboard: {
      id,
      name: 'Home',
    },
    initialized: true,
  }
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = getRuntimeConfig(event)
  const cookies = h3CookieController(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  try {
    const { session } = await resolveSession({ event, runtimeConfig, cookies })
    if (!session) throw new ApiError(401, 'unauthenticated', 'Authentication is required.')
    if (!session.onboardingCompleted) throw new ApiError(409, 'onboarding_required', 'Onboarding must be completed before Home is available.')

    const pb = getRequestPocketBase(event, runtimeConfig, event.context.pocketBaseAuthToken)
    const dashboard = await pb.collection('dashboards').getFirstListItem(
      `owner = "${filterValue(session.id)}" && seedKey = "home"`,
      { requestKey: null },
    ) as Record<string, unknown>

    return assertValidHomeSeed(dashboard, session.id)
  } catch (error) {
    const apiError = error instanceof ApiError
      ? error
      : hasStatus(error, 404)
        ? new ApiError(409, 'home_inconsistent', 'Initial landing is not initialized correctly.')
        : toApiError(new ApiError(503, 'home_unavailable', 'Landing is temporarily unavailable. Please retry.'))

    setResponseStatus(event, apiError.statusCode)
    return apiErrorBody(apiError)
  }
})
