import type { SafeSessionDto } from '../../shared/types/auth'

export type AuthRoutePath = '/' | '/login' | '/onboarding'

export type AuthRouteState =
  | { readonly kind: 'anonymous' }
  | { readonly kind: 'authenticated', readonly session: SafeSessionDto }
  | { readonly kind: 'unavailable', readonly message: string }

export interface AuthRouteDecision {
  readonly status: 200 | 302 | 503
  readonly location?: AuthRoutePath
  readonly renderPath: AuthRoutePath
  readonly cacheControl?: string
}

export const normalizeAuthRoutePath = (path: string): AuthRoutePath | undefined => {
  const pathname = path.split(/[?#]/, 1)[0] || '/'
  if (pathname === '/' || pathname === '/login' || pathname === '/onboarding') {
    return pathname
  }
  return undefined
}

export const decideAuthRoute = (path: string, state: AuthRouteState): AuthRouteDecision => {
  const routePath = normalizeAuthRoutePath(path)

  if (!routePath) {
    return { status: 200, renderPath: '/' }
  }

  if (state.kind === 'unavailable') {
    return {
      status: 503,
      renderPath: routePath,
      cacheControl: 'private, no-store',
    }
  }

  if (state.kind === 'anonymous') {
    if (routePath === '/login') {
      return { status: 200, renderPath: '/login' }
    }

    return {
      status: 302,
      location: '/login',
      renderPath: '/login',
    }
  }

  const cacheControl = 'private, no-store'

  if (!state.session.onboardingCompleted) {
    if (routePath === '/onboarding') {
      return { status: 200, renderPath: '/onboarding', cacheControl }
    }

    return {
      status: 302,
      location: '/onboarding',
      renderPath: '/onboarding',
      cacheControl,
    }
  }

  if (routePath === '/') {
    return { status: 200, renderPath: '/', cacheControl }
  }

  return {
    status: 302,
    location: '/',
    renderPath: '/',
    cacheControl,
  }
}
