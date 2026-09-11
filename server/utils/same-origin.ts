import { ApiError } from './api-error'
import { getSessionConfig, type SessionRuntimeConfig } from './session-config'

export interface HeaderReader {
  readonly getHeader: (name: string) => string | undefined
}

export const validateSameOrigin = (headers: HeaderReader, runtimeConfig: SessionRuntimeConfig): void => {
  const { appOrigin } = getSessionConfig(runtimeConfig)
  const origin = headers.getHeader('origin')

  if (!origin || origin === 'null') {
    throw new ApiError(403, 'forbidden_origin', 'Request origin is not allowed.')
  }

  let parsedOrigin: string
  try {
    parsedOrigin = new URL(origin).origin
  } catch {
    throw new ApiError(403, 'forbidden_origin', 'Request origin is not allowed.')
  }

  if (parsedOrigin !== appOrigin) {
    throw new ApiError(403, 'forbidden_origin', 'Request origin is not allowed.')
  }

  const fetchSite = headers.getHeader('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin') {
    throw new ApiError(403, 'forbidden_origin', 'Request origin is not allowed.')
  }
}
