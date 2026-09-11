export type SessionCookieMode = 'secure' | 'development-http'

export interface SessionRuntimeConfig {
  appOrigin?: unknown
  sessionCookieMode?: unknown
}

export interface SessionConfig {
  readonly appOrigin: string
  readonly cookieName: string
  readonly secure: boolean
}

const originError = (): Error => new Error('NUXT_APP_ORIGIN must be an absolute HTTP or HTTPS origin without credentials, path, query, or fragment.')
const modeError = (): Error => new Error('NUXT_SESSION_COOKIE_MODE must be secure or development-http.')

export const parseAppOrigin = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw originError()
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw originError()
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== '/' ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw originError()
  }

  return url.origin
}

export const parseSessionCookieMode = (value: unknown): SessionCookieMode => {
  if (value === undefined || value === null || value === '') {
    return 'secure'
  }

  if (value === 'secure' || value === 'development-http') {
    return value
  }

  throw modeError()
}

export const getSessionConfig = (runtimeConfig: SessionRuntimeConfig): SessionConfig => {
  const appOrigin = parseAppOrigin(runtimeConfig.appOrigin)
  const mode = parseSessionCookieMode(runtimeConfig.sessionCookieMode)

  if (mode === 'development-http') {
    if (!appOrigin.startsWith('http://')) {
      throw new Error('development-http session cookie mode requires an HTTP NUXT_APP_ORIGIN.')
    }

    return Object.freeze({
      appOrigin,
      cookieName: 'kunai_session',
      secure: false,
    })
  }

  if (!appOrigin.startsWith('https://')) {
    throw new Error('secure session cookie mode requires an HTTPS NUXT_APP_ORIGIN.')
  }

  return Object.freeze({
    appOrigin,
    cookieName: '__Host-kunai_session',
    secure: true,
  })
}
