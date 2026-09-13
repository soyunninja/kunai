export interface ApiErrorBody {
  readonly error: {
    readonly code: string
    readonly message: string
    readonly fields?: Readonly<Record<string, string>>
  }
}

export class ApiError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly fields?: Readonly<Record<string, string>>

  constructor(statusCode: number, code: string, message: string, fields?: Readonly<Record<string, string>>) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.fields = fields
  }
}

export const apiErrorBody = (error: ApiError): ApiErrorBody => ({
  error: {
    code: error.code,
    message: error.message,
    ...(error.fields ? { fields: error.fields } : {}),
  },
})

export const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error
  }

  return new ApiError(500, 'internal_error', 'Something went wrong.')
}

const hasStatus = (error: unknown, status: number): boolean => (
  typeof error === 'object'
  && error !== null
  && 'status' in error
  && error.status === status
)

export const toOnboardingApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error
  }

  if (hasStatus(error, 401) || hasStatus(error, 403)) {
    return new ApiError(401, 'unauthenticated', 'Authentication is required.')
  }

  if (hasStatus(error, 400) || hasStatus(error, 404) || hasStatus(error, 409)) {
    return new ApiError(409, 'seed_conflict', 'Onboarding seed is incompatible with the required initial state.')
  }

  return new ApiError(503, 'onboarding_unavailable', 'Onboarding is temporarily unavailable. Please retry.')
}
