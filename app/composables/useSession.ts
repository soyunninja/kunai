import { computed, readonly } from 'vue'
import { useState } from '#imports'

import type { SafeSessionDto, SessionEnvelope } from '../../shared/types/auth'

export type SessionValidationState = 'idle' | 'loading' | 'ready' | 'unavailable'

export interface LoginCredentials {
  readonly email: string
  readonly password: string
}

const hasNumericStatusCode = (error: unknown): error is { readonly statusCode: number } => (
  typeof error === 'object'
  && error !== null
  && 'statusCode' in error
  && typeof error.statusCode === 'number'
)

export const useSession = () => {
  const session = useState<SafeSessionDto | null>('kunai.safe-session', () => null)
  const validationState = useState<SessionValidationState>('kunai.session-validation-state', () => 'idle')
  const validationMessage = useState<string>('kunai.session-validation-message', () => '')
  const requestEpoch = useState<number>('kunai.session-request-epoch', () => 0)

  const isAuthenticated = computed(() => session.value !== null)
  const onboardingCompleted = computed(() => session.value?.onboardingCompleted === true)

  const beginRequest = () => {
    requestEpoch.value += 1
    validationState.value = 'loading'
    return requestEpoch.value
  }

  const acceptResponse = (epoch: number) => epoch === requestEpoch.value

  const applySession = (epoch: number, envelope: SessionEnvelope): SessionEnvelope => {
    if (!acceptResponse(epoch)) {
      return { session: session.value }
    }

    session.value = envelope.session
    validationMessage.value = ''
    validationState.value = 'ready'
    return envelope
  }

  const handleUnavailable = (
    epoch: number,
    message: string,
    preserveSession = false,
  ): SessionEnvelope => {
    if (!acceptResponse(epoch)) {
      return { session: session.value }
    }

    if (!preserveSession) {
      session.value = null
    }
    validationMessage.value = message
    validationState.value = 'unavailable'
    return { session: session.value }
  }

  const handleInvalidLogin = (epoch: number): void => {
    if (!acceptResponse(epoch)) {
      return
    }

    session.value = null
    validationMessage.value = 'Invalid email or password'
    validationState.value = 'ready'
  }

  const refreshSession = async (): Promise<SessionEnvelope> => {
    const epoch = beginRequest()

    try {
      const envelope = await $fetch<SessionEnvelope>('/api/auth/session')
      return applySession(epoch, envelope)
    } catch (error) {
      const statusCode = hasNumericStatusCode(error) ? error.statusCode : 0

      if (statusCode === 401) {
        return applySession(epoch, { session: null })
      }

      return handleUnavailable(epoch, 'Session could not be validated')
    }
  }

  const login = async (credentials: LoginCredentials): Promise<SessionEnvelope> => {
    const epoch = beginRequest()

    try {
      const envelope = await $fetch<SessionEnvelope>('/api/auth/login', {
        method: 'POST',
        body: credentials,
      })

      return applySession(epoch, envelope)
    } catch (error) {
      const statusCode = hasNumericStatusCode(error) ? error.statusCode : 0

      if (statusCode === 401) {
        handleInvalidLogin(epoch)
      } else {
        handleUnavailable(epoch, 'Login is temporarily unavailable', true)
      }

      throw error
    }
  }

  const logout = async (): Promise<void> => {
    const epoch = beginRequest()
    session.value = null
    validationMessage.value = ''

    try {
      await $fetch('/api/auth/logout', { method: 'POST' })

      if (acceptResponse(epoch)) {
        session.value = null
        validationState.value = 'ready'
      }
    } catch (error) {
      if (acceptResponse(epoch)) {
        session.value = null
        validationMessage.value = 'Session could not be updated'
        validationState.value = 'unavailable'
      }
      throw error
    }
  }

  return {
    session: readonly(session),
    validationState: readonly(validationState),
    validationMessage: readonly(validationMessage),
    isAuthenticated,
    onboardingCompleted,
    refreshSession,
    login,
    logout,
  }
}
