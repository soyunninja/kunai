// @vitest-environment node
import { createServer } from 'node:http'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'

const protectedSentinel = 'pb-token-sentinel-must-not-reach-ssr'
const internalSentinel = 'pb-internal-dashboard-id-sentinel'

const collectSources = async (directory: string): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const contents = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return await collectSources(path)
    if (!entry.isFile() || !/\.(?:ts|vue)$/.test(entry.name)) return []
    return [await readFile(path, 'utf8')]
  }))
  return contents.flat()
}

const startSessionProvider = async () => {
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url?.startsWith('/api/collections/dashboards/records')) {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({
        items: [{
          id: internalSentinel,
          owner: 'complete-user',
          seedKey: 'home',
          name: 'Home',
          sortOrder: 0,
          token: protectedSentinel,
          collectionId: 'pocketbase-internal-id',
        }],
      }))
      return
    }

    if (request.method !== 'POST' || request.url !== '/api/collections/users/auth-refresh') {
      response.writeHead(404).end()
      return
    }

    const token = request.headers.authorization?.replace(/^Bearer\s+/, '') ?? ''
    if (token === 'outage-token') {
      response.writeHead(503, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ message: 'PocketBase unavailable' }))
      return
    }
    if (token !== 'complete-token') {
      response.writeHead(401, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ message: 'invalid session' }))
      return
    }

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({
      token: protectedSentinel,
      record: {
        id: 'complete-user',
        displayName: 'SSR Security User',
        avatarKey: 'avatar-01',
        onboardingCompleted: true,
        email: 'private@example.test',
      },
    }))
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Session provider did not bind to TCP.')

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    stop: async () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    }),
  }
}

const sessionProvider = await startSessionProvider()

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  env: {
    NUXT_POCKETBASE_URL: sessionProvider.baseUrl,
    NUXT_APP_ORIGIN: 'http://localhost:3000',
    NUXT_SESSION_COOKIE_MODE: 'development-http',
  },
})

afterAll(async () => {
  await sessionProvider.stop()
})

const requestHome = async (cookie?: string) => fetch('/', {
  headers: cookie ? { cookie } : undefined,
  redirect: 'manual',
})

describe('Phase 0002 SSR and browser leakage security', () => {
  it('renders no protected identity or Home data for anonymous, invalid, or unavailable SSR requests', async () => {
    const [anonymous, invalid, unavailable] = await Promise.all([
      requestHome(),
      requestHome('kunai_session=invalid-token'),
      requestHome('kunai_session=outage-token'),
    ])
    const [anonymousHtml, invalidHtml, unavailableHtml] = await Promise.all([
      anonymous.text(),
      invalid.text(),
      unavailable.text(),
    ])

    expect(anonymous.status).toBe(302)
    expect(anonymous.headers.get('location')).toBe('/login')
    expect(invalid.status).toBe(302)
    expect(invalid.headers.get('location')).toBe('/login')
    expect(unavailable.status).toBe(503)
    expect(unavailable.headers.get('cache-control')).toContain('private, no-store')
    for (const html of [anonymousHtml, invalidHtml, unavailableHtml]) {
      expect(html).not.toContain('SSR Security User')
      expect(html).not.toContain(internalSentinel)
      expect(html).not.toContain(protectedSentinel)
    }
  })

  it('projects only safe SSR data and never serializes PocketBase tokens, internals, or raw auth payloads', async () => {
    const response = await requestHome('kunai_session=complete-token')
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('private, no-store')
    expect(html).toContain('SSR Security User')
    for (const forbidden of [
      protectedSentinel,
      internalSentinel,
      'private@example.test',
      'pocketbase-internal-id',
      'authStore',
      'rawSession',
      'accessToken',
    ]) {
      expect(html).not.toContain(forbidden)
    }
  })

  it('keeps PocketBase, browser storage bearer tokens, and private runtime configuration out of client application sources', async () => {
    const appSources = await collectSources('app')
    const source = appSources.join('\n')
    const nuxtConfig = await readFile('nuxt.config.ts', 'utf8')
    const safeSessionType = await readFile('shared/types/auth.ts', 'utf8')

    expect(source).not.toMatch(/from\s+['"]pocketbase['"]|require\(['"]pocketbase['"]\)/)
    expect(source).not.toMatch(/\b(?:localStorage|sessionStorage)\b/)
    expect(source).not.toMatch(/Bearer\s+|authStore\.save/i)
    expect(nuxtConfig).toContain('runtimeConfig')
    expect(nuxtConfig).not.toMatch(/public\s*:\s*{[^}]*?(?:pocketbase|secret|token|key)/is)
    expect(safeSessionType).toContain('SafeSessionDto')
    expect(safeSessionType).not.toMatch(/(?:token|password|email|authStore|refreshToken)\s*:/i)
  })
})
