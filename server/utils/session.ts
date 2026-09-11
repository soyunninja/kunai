import { ClientResponseError, type RecordModel } from 'pocketbase'

import type { SafeSessionDto, SessionEnvelope } from '../../shared/types/auth'
import { ApiError } from './api-error'
import { getRequestPocketBase, type RequestEventLike } from './pocketbase-client'
import type { PocketBaseRuntimeConfig } from './pocketbase'
import { getSessionConfig, type SessionRuntimeConfig } from './session-config'

export interface CookieController {
  readonly getCookie: (name: string) => string | undefined
  readonly setCookie: (name: string, value: string, options: SessionCookieOptions) => void
  readonly deleteCookie: (name: string, options: SessionCookieOptions) => void
}

export interface SessionCookieOptions {
  readonly httpOnly: true
  readonly sameSite: 'lax'
  readonly path: '/'
  readonly secure: boolean
  readonly maxAge?: number
}

export interface SessionDependencies {
  readonly event: RequestEventLike
  readonly runtimeConfig: PocketBaseRuntimeConfig & SessionRuntimeConfig
  readonly cookies: CookieController
}

const tokenExpirySeconds = (token: string): number | undefined => {
  const [, payload] = token.split('.')
  if (!payload) {
    return undefined
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const parsed = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')) as { exp?: unknown }
    if (typeof parsed.exp !== 'number') {
      return undefined
    }

    const seconds = Math.floor(parsed.exp - Date.now() / 1000)
    return seconds > 0 ? seconds : 0
  } catch {
    return undefined
  }
}

export const sessionCookieOptions = (
  runtimeConfig: SessionRuntimeConfig,
  token?: string,
): SessionCookieOptions => {
  const { secure } = getSessionConfig(runtimeConfig)
  const maxAge = token ? tokenExpirySeconds(token) : undefined

  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    ...(maxAge !== undefined ? { maxAge } : {}),
  }
}

export const projectSession = (record: RecordModel): SafeSessionDto => ({
  id: String(record.id),
  displayName: typeof record.displayName === 'string' ? record.displayName : '',
  avatarKey: typeof record.avatarKey === 'string' ? record.avatarKey : '',
  onboardingCompleted: Boolean(record.onboardingCompleted),
})

export const setSessionCookie = (dependencies: SessionDependencies, token: string): void => {
  const { cookieName } = getSessionConfig(dependencies.runtimeConfig)
  dependencies.cookies.setCookie(cookieName, token, sessionCookieOptions(dependencies.runtimeConfig, token))
}

export const clearSessionCookie = (dependencies: SessionDependencies): void => {
  const { cookieName } = getSessionConfig(dependencies.runtimeConfig)
  dependencies.cookies.deleteCookie(cookieName, sessionCookieOptions(dependencies.runtimeConfig))
}

export const resolveSession = async (dependencies: SessionDependencies): Promise<SessionEnvelope> => {
  const { cookieName } = getSessionConfig(dependencies.runtimeConfig)
  const token = dependencies.cookies.getCookie(cookieName)

  if (!token) {
    return { session: null }
  }

  const pb = getRequestPocketBase(dependencies.event, dependencies.runtimeConfig, token)

  try {
    const auth = await pb.collection('users').authRefresh()
    dependencies.event.context.pocketBaseAuthIntent = 'authenticated'
    dependencies.event.context.pocketBaseAuthToken = auth.token
    setSessionCookie(dependencies, auth.token)
    return { session: projectSession(auth.record) }
  } catch (error) {
    if (error instanceof ClientResponseError && [400, 401, 403].includes(error.status)) {
      pb.authStore.clear()
      delete dependencies.event.context.pocketBaseAuthIntent
      delete dependencies.event.context.pocketBaseAuthToken
      clearSessionCookie(dependencies)
      return { session: null }
    }

    pb.authStore.clear()
    delete dependencies.event.context.pocketBaseClient
    delete dependencies.event.context.pocketBaseAuthIntent
    delete dependencies.event.context.pocketBaseAuthToken
    throw new ApiError(503, 'session_unavailable', 'Session could not be validated. Please retry.')
  }
}

export const loginWithPassword = async (
  dependencies: SessionDependencies,
  credentials: { email: string, password: string },
): Promise<SessionEnvelope> => {
  const pb = getRequestPocketBase(dependencies.event, dependencies.runtimeConfig)

  try {
    const auth = await pb.collection('users').authWithPassword(credentials.email, credentials.password)
    dependencies.event.context.pocketBaseAuthIntent = 'authenticated'
    dependencies.event.context.pocketBaseAuthToken = auth.token
    setSessionCookie(dependencies, auth.token)
    return { session: projectSession(auth.record) }
  } catch (error) {
    if (error instanceof ClientResponseError && [400, 401, 403].includes(error.status)) {
      pb.authStore.clear()
      delete dependencies.event.context.pocketBaseAuthIntent
      delete dependencies.event.context.pocketBaseAuthToken
      clearSessionCookie(dependencies)
      throw new ApiError(401, 'invalid_credentials', 'Invalid email or password.')
    }

    throw new ApiError(503, 'session_unavailable', 'Session is temporarily unavailable. Please retry.')
  }
}

export const logoutSession = (dependencies: SessionDependencies): void => {
  const pb = dependencies.event.context.pocketBaseClient ?? getRequestPocketBase(dependencies.event, dependencies.runtimeConfig)
  pb.authStore.clear()
  delete dependencies.event.context.pocketBaseAuthIntent
  delete dependencies.event.context.pocketBaseAuthToken
  clearSessionCookie(dependencies)
}
