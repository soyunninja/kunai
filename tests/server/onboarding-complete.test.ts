import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { createApp, toNodeListener } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../server/utils/api-error'
import type { SafeSessionDto } from '../../shared/types/auth'

const sessionState = vi.hoisted(() => ({
  value: null as SafeSessionDto | null,
}))

const finalSession = vi.hoisted(() => ({
  value: {
    id: 'user-incomplete',
    displayName: 'Final User',
    avatarKey: 'avatar-02',
    onboardingCompleted: true,
  } as SafeSessionDto,
}))

const completionState = vi.hoisted(() => ({
  run: async (_input: unknown): Promise<unknown> => ({ status: 'completed', session: finalSession.value }),
}))

vi.mock('../../server/utils/runtime-config', () => ({
  getRuntimeConfig: () => ({
    pocketbaseUrl: 'http://127.0.0.1:8090',
    appOrigin: 'http://localhost:3000',
    sessionCookieMode: 'development-http',
  }),
}))

vi.mock('../../server/utils/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/session')>()

  return {
    ...original,
    resolveSession: async () => ({ session: sessionState.value }),
  }
})

vi.mock('../../server/utils/pocketbase-client', () => ({
  getRequestPocketBase: () => ({}),
}))

vi.mock('../../server/utils/onboarding', () => ({
  completeOnboarding: async (input: unknown) => await completionState.run(input),
}))

const { default: completeHandler } = await import('../../server/api/onboarding/complete.post')

const incompleteSession: SafeSessionDto = {
  id: 'user-incomplete',
  displayName: 'Draft User',
  avatarKey: 'avatar-01',
  onboardingCompleted: false,
}

const completedSession: SafeSessionDto = {
  ...incompleteSession,
  onboardingCompleted: true,
}

const validPayload = {
  displayName: 'Final User',
  avatarKey: 'avatar-02',
  timezone: 'Europe/Madrid',
  defaultLocation: null,
}

const postCompletion = async (baseUrl: string): Promise<Response> => await fetch(`${baseUrl}/api/onboarding/complete`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin: 'http://localhost:3000',
    'sec-fetch-site': 'same-origin',
  },
  body: JSON.stringify(validPayload),
})

describe('POST /api/onboarding/complete', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    const app = createApp()
    app.use('/api/onboarding/complete', completeHandler)
    server = createServer(toNodeListener(app))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  })

  beforeEach(() => {
    sessionState.value = incompleteSession
    completionState.run = async () => ({ status: 'completed', session: finalSession.value })
  })

  it('returns the final persisted safe session instead of patching the stale pre-completion snapshot', async () => {
    sessionState.value = {
      id: 'user-incomplete',
      displayName: 'Old User',
      avatarKey: 'avatar-01',
      onboardingCompleted: false,
    }
    const durableFinalSession = {
      id: 'user-incomplete',
      displayName: 'Final User',
      avatarKey: 'avatar-02',
      onboardingCompleted: true,
    } satisfies SafeSessionDto
    completionState.run = async () => ({ status: 'completed', session: durableFinalSession })

    const response = await postCompletion(baseUrl)
    const body = await response.json() as { session?: Record<string, unknown> }

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toEqual({ session: durableFinalSession })
    expect(Object.keys(body.session ?? {}).sort()).toEqual(['avatarKey', 'displayName', 'id', 'onboardingCompleted'])
    expect(JSON.stringify(body)).not.toContain('Old User')
    expect(JSON.stringify(body)).not.toContain('avatar-01')
    expect(JSON.stringify(body)).not.toContain('timezone')
    expect(JSON.stringify(body)).not.toContain('token')
    expect(JSON.stringify(body)).not.toContain('cookie')
  })

  it.each([
    [new ApiError(409, 'seed_conflict', 'Onboarding seed is incompatible with the required initial state.'), 409, 'seed_conflict'],
    [new ApiError(503, 'onboarding_retry_exhausted', 'Onboarding is still busy. Please retry.'), 503, 'onboarding_retry_exhausted'],
    [new ApiError(503, 'response_lost', 'The completion response was lost. Please refresh.'), 503, 'response_lost'],
    [new ApiError(503, 'onboarding_unavailable', 'Onboarding is temporarily unavailable. Please retry.'), 503, 'onboarding_unavailable'],
  ] as const)('returns a private, sanitized %s response', async (failure, expectedStatus, expectedCode) => {
    completionState.run = async () => {
      throw failure
    }

    const response = await postCompletion(baseUrl)
    const body = await response.json() as { error?: { code?: string, message?: string } }
    const serialized = JSON.stringify(body)

    expect(response.status).toBe(expectedStatus)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body.error?.code).toBe(expectedCode)
    expect(serialized).not.toContain('users')
    expect(serialized).not.toContain('token')
    expect(serialized).not.toContain('cookie')
    expect(serialized).not.toContain('SELECT')
  })

  it('maps a temporary PocketBase failure to a bounded retry response without exposing the upstream detail', async () => {
    const upstreamDetail = 'SQLITE_BUSY users token cookie SELECT * FROM auth'
    completionState.run = async () => {
      const error = new Error(upstreamDetail) as Error & { status: number }
      error.status = 503
      throw error
    }

    const response = await postCompletion(baseUrl)
    const body = await response.json() as { error?: { code?: string, message?: string } }
    const serialized = JSON.stringify(body)

    expect(response.status).toBe(503)
    expect(body.error).toEqual({
      code: 'onboarding_unavailable',
      message: 'Onboarding is temporarily unavailable. Please retry.',
    })
    expect(serialized).not.toContain(upstreamDetail)
  })

  it('clears an expired session cookie and returns an unauthenticated result without reporting completion', async () => {
    completionState.run = async () => {
      throw new ApiError(401, 'unauthenticated', 'Authentication is required.')
    }

    const response = await postCompletion(baseUrl)
    const body = await response.json() as { error?: { code?: string } }

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('set-cookie')).toContain('kunai_session=')
    expect(body).toEqual({ error: { code: 'unauthenticated', message: 'Authentication is required.' } })
    expect(JSON.stringify(body)).not.toContain('onboardingCompleted')
  })

  it('keeps a completed replay read-only by returning a bounded conflict before invoking completion', async () => {
    sessionState.value = completedSession
    completionState.run = async () => {
      throw new Error('a completed replay must not write onboarding data')
    }

    const response = await postCompletion(baseUrl)
    const body = await response.json() as { error?: { code?: string } }

    expect(response.status).toBe(409)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toEqual({
      error: {
        code: 'onboarding_already_completed',
        message: 'Onboarding has already been completed.',
      },
    })
  })
})
