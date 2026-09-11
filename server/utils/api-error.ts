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
