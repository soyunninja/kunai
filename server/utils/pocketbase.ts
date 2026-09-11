export interface PocketBaseRuntimeConfig {
  pocketbaseUrl: unknown
}

export interface PocketBaseConfig {
  readonly endpoint: string
}

const configurationError = (): Error =>
  new Error(
    'NUXT_POCKETBASE_URL must be an absolute HTTP or HTTPS URL without credentials, query parameters, or fragments.',
  )

export const parsePocketBaseEndpoint = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw configurationError()
  }

  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw configurationError()
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.hostname.length === 0 ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw configurationError()
  }

  const pathPrefix = url.pathname.replace(/\/+$/, '')

  return `${url.origin}${pathPrefix}`
}

export const getPocketBaseConfig = (
  config: PocketBaseRuntimeConfig,
): Readonly<PocketBaseConfig> =>
  Object.freeze({ endpoint: parsePocketBaseEndpoint(config.pocketbaseUrl) })
