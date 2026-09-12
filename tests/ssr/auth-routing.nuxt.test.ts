import { describe, expect, it } from 'vitest'

import type { SafeSessionDto } from '../../shared/types/auth'
import { decideAuthRoute } from '../../app/utils/auth-routing'

const incompleteUser: SafeSessionDto = {
  id: 'incomplete-user',
  displayName: 'Incomplete User',
  avatarKey: 'avatar-incomplete',
  onboardingCompleted: false,
}

const completedUser: SafeSessionDto = {
  id: 'completed-user',
  displayName: 'Completed User',
  avatarKey: 'avatar-complete',
  onboardingCompleted: true,
}

describe('auth route decisions', () => {
  it('allows anonymous users to render only login', () => {
    expect(decideAuthRoute('/', { kind: 'anonymous' })).toEqual({
      status: 302,
      location: '/login',
      renderPath: '/login',
    })
    expect(decideAuthRoute('/login', { kind: 'anonymous' })).toEqual({
      status: 200,
      renderPath: '/login',
    })
  })

  it('routes incomplete sessions to onboarding with private no-store responses', () => {
    expect(decideAuthRoute('/', { kind: 'authenticated', session: incompleteUser })).toEqual({
      status: 302,
      location: '/onboarding',
      renderPath: '/onboarding',
      cacheControl: 'private, no-store',
    })
    expect(decideAuthRoute('/onboarding', { kind: 'authenticated', session: incompleteUser })).toEqual({
      status: 200,
      renderPath: '/onboarding',
      cacheControl: 'private, no-store',
    })
  })

  it('allows completed sessions to render only Home with private no-store responses', () => {
    expect(decideAuthRoute('/', { kind: 'authenticated', session: completedUser })).toEqual({
      status: 200,
      renderPath: '/',
      cacheControl: 'private, no-store',
    })
    expect(decideAuthRoute('/login', { kind: 'authenticated', session: completedUser })).toEqual({
      status: 302,
      location: '/',
      renderPath: '/',
      cacheControl: 'private, no-store',
    })
  })

  it('marks recognized routes unavailable without selecting protected output', () => {
    expect(decideAuthRoute('/', {
      kind: 'unavailable',
      message: 'Session could not be validated',
    })).toEqual({
      status: 503,
      renderPath: '/',
      cacheControl: 'private, no-store',
    })
  })
})
