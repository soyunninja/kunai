import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from '#imports'

import { useSession } from '../../app/composables/useSession'
import type { SafeSessionDto, SessionEnvelope } from '../../shared/types/auth'
import type { SessionValidationState } from '../../app/composables/useSession'

const userA: SafeSessionDto = {
  id: 'user-a',
  displayName: 'User A',
  avatarKey: 'avatar-user-a',
  onboardingCompleted: true,
}

const resetSessionState = () => {
  useState<SafeSessionDto | null>('kunai.safe-session', () => null).value = null
  useState<SessionValidationState>('kunai.session-validation-state', () => 'idle').value = 'idle'
  useState<string>('kunai.session-validation-message', () => '').value = ''
  useState<number>('kunai.session-request-epoch', () => 0).value = 0
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetSessionState()
})

describe('useSession stale response suppression', () => {
  it('does not repaint a stale session response after logout wins the client race', async () => {
    resetSessionState()
    const refreshResponse = Promise.withResolvers<SessionEnvelope>()
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/session') {
        return refreshResponse.promise
      }
      if (path === '/api/auth/logout') {
        return Promise.resolve(null)
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`))
    })
    vi.stubGlobal('$fetch', fetchMock)

    const client = useSession()
    const staleRefresh = client.refreshSession()
    await client.logout()

    expect(client.session.value).toBeNull()

    refreshResponse.resolve({ session: userA })
    await staleRefresh

    expect(client.session.value).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session')
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
  })

  it('does not repaint a stale login response after a newer session refresh resolves anonymous', async () => {
    resetSessionState()
    const loginResponse = Promise.withResolvers<SessionEnvelope>()
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/login') {
        return loginResponse.promise
      }
      if (path === '/api/auth/session') {
        return Promise.resolve({ session: null })
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`))
    })
    vi.stubGlobal('$fetch', fetchMock)

    const client = useSession()
    const staleLogin = client.login({ email: 'user@example.test', password: 'password' })
    await client.refreshSession()

    expect(client.session.value).toBeNull()

    loginResponse.resolve({ session: userA })
    await staleLogin

    expect(client.session.value).toBeNull()
  })

  it('settles invalid login failures as ready after the server clears the session', async () => {
    resetSessionState()
    const fetchMock = vi.fn(() => Promise.reject({ statusCode: 401 }))
    vi.stubGlobal('$fetch', fetchMock)

    const client = useSession()
    useState<SafeSessionDto | null>('kunai.safe-session', () => null).value = userA

    await expect(client.login({ email: 'user@example.test', password: 'wrong-password' })).rejects.toEqual({ statusCode: 401 })

    expect(client.session.value).toBeNull()
    expect(client.validationState.value).toBe('ready')
    expect(client.validationMessage.value).toBe('Invalid email or password')
  })

  it('keeps an existing session after a transient login failure while leaving loading', async () => {
    resetSessionState()
    const fetchMock = vi.fn(() => Promise.reject({ statusCode: 503 }))
    vi.stubGlobal('$fetch', fetchMock)

    const client = useSession()
    useState<SafeSessionDto | null>('kunai.safe-session', () => null).value = userA

    await expect(client.login({ email: 'user@example.test', password: 'password' })).rejects.toEqual({ statusCode: 503 })

    expect(client.session.value).toEqual(userA)
    expect(client.validationState.value).toBe('unavailable')
    expect(client.validationMessage.value).toBe('Login is temporarily unavailable')
  })

  it('does not let a stale login failure overwrite a newer session refresh', async () => {
    resetSessionState()
    const loginResponse = Promise.withResolvers<SessionEnvelope>()
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/login') {
        return loginResponse.promise
      }
      if (path === '/api/auth/session') {
        return Promise.resolve({ session: userA })
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`))
    })
    vi.stubGlobal('$fetch', fetchMock)

    const client = useSession()
    const staleLogin = client.login({ email: 'user@example.test', password: 'password' })
    await client.refreshSession()

    loginResponse.reject({ statusCode: 503 })
    await expect(staleLogin).rejects.toEqual({ statusCode: 503 })

    expect(client.session.value).toEqual(userA)
    expect(client.validationState.value).toBe('ready')
    expect(client.validationMessage.value).toBe('')
  })

  it('leaves logout failures in a recoverable non-loading state', async () => {
    resetSessionState()
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/logout') {
        return Promise.reject(new Error('temporary logout failure'))
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`))
    })
    vi.stubGlobal('$fetch', fetchMock)

    const client = useSession()
    useState<SafeSessionDto | null>('kunai.safe-session', () => null).value = userA

    await expect(client.logout()).rejects.toThrow('temporary logout failure')

    expect(client.session.value).toBeNull()
    expect(client.validationState.value).toBe('unavailable')
    expect(client.validationMessage.value).toBe('Session could not be updated')
  })
})
