import { describe, expect, it, vi } from 'vitest'

import {
  getPocketBaseConfig,
  parsePocketBaseEndpoint,
} from '../server/utils/pocketbase'
import { validatePocketBaseRuntimeConfig } from '../server/plugins/pocketbase-config'

describe('parsePocketBaseEndpoint', () => {
  it.each([
    ['http://127.0.0.1:8090', 'http://127.0.0.1:8090'],
    ['https://pocketbase.example.com', 'https://pocketbase.example.com'],
    ['https://pocketbase.example.com:9443/api/', 'https://pocketbase.example.com:9443/api'],
    ['http://localhost:8090/prefix///', 'http://localhost:8090/prefix'],
  ])('normalizes a valid endpoint %s', (value, expected) => {
    expect(parsePocketBaseEndpoint(value)).toBe(expected)
  })

  it.each([
    undefined,
    '',
    '   ',
    8090,
    'not a URL',
    '/relative/path',
    'ftp://pocketbase.example.com',
    'http://user:password@pocketbase.example.com',
    'https://pocketbase.example.com?token=secret',
    'https://pocketbase.example.com#credentials',
  ])('rejects an unsafe or invalid endpoint', (value) => {
    expect(() => parsePocketBaseEndpoint(value)).toThrowError('NUXT_POCKETBASE_URL')
  })

  it('does not echo a credential-like supplied value in errors', () => {
    const credentialLikeValue = 'http://admin:top-secret@pocketbase.example.com'

    expect(() => parsePocketBaseEndpoint(credentialLikeValue)).toThrowError(
      'NUXT_POCKETBASE_URL',
    )

    try {
      parsePocketBaseEndpoint(credentialLikeValue)
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error)
      if (error instanceof Error) {
        expect(error.message).not.toContain(credentialLikeValue)
        expect(error.message).not.toContain('top-secret')
      }
    }
  })
})

describe('getPocketBaseConfig', () => {
  it('exposes only a normalized endpoint', () => {
    expect(
      getPocketBaseConfig({ pocketbaseUrl: 'https://pocketbase.example.com/api/' }),
    ).toEqual({ endpoint: 'https://pocketbase.example.com/api' })
  })
})

describe('PocketBase configuration startup validation', () => {
  it('allows a syntactically valid but unreachable endpoint without network I/O', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    expect(() =>
      validatePocketBaseRuntimeConfig({
        pocketbaseUrl: 'http://127.0.0.1:8090/unreachable',
      }),
    ).not.toThrow()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it.each([undefined, 'not a URL'])('fails startup validation for %j', (value) => {
    expect(() =>
      validatePocketBaseRuntimeConfig({ pocketbaseUrl: value }),
    ).toThrowError('NUXT_POCKETBASE_URL')
  })
})
