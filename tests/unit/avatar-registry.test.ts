import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { access } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  AVATAR_REGISTRY,
  avatarKeyAllowlist,
  isApprovedAvatarKey,
  isSafeAvatarSrc,
  validateAvatarRegistry,
  type AvatarRegistry,
} from '../../shared/avatars'

const require = createRequire(import.meta.url)
const pocketBaseAvatarManifest = require('../../pb_hooks/lib/avatar-manifest.js') as {
  readonly AVATAR_MANIFEST: AvatarRegistry
  readonly avatarKeyAllowlist: (manifest: unknown) => readonly string[]
  readonly isSafeAvatarSrc: (src: string) => boolean
  readonly validateAvatarManifest: (manifest: unknown) => { readonly ok: boolean, readonly errors: readonly string[] }
}

const expectedProductionRegistry = JSON.parse(readFileSync('project/avatar-registry.json', 'utf8')) as AvatarRegistry

const generatedAvatarFiles = [
  'shared/generated/avatars.ts',
  'pb_hooks/lib/avatar-manifest.js',
] as const

const fixtureAvatarRegistry = [
  {
    key: 'fixture-avatar-a',
    src: '/avatars/fixtures/avatar-a.svg',
    label: 'Fixture avatar A',
  },
  {
    key: 'fixture-avatar-b',
    src: '/avatars/fixtures/avatar-b.svg',
    label: 'Fixture avatar B',
  },
] as const satisfies AvatarRegistry

const productionKeys = expectedProductionRegistry.map((entry) => entry.key)

const publicPathFor = (src: string) => join(process.cwd(), 'public', src.replace(/^\//, ''))

describe('avatar registry contract', () => {
  it('registers exactly the owner-approved production avatars', () => {
    expect(AVATAR_REGISTRY).toEqual(expectedProductionRegistry)
    expect(avatarKeyAllowlist()).toEqual(productionKeys)
  })

  it('has no duplicate production keys', () => {
    expect(new Set(avatarKeyAllowlist()).size).toBe(AVATAR_REGISTRY.length)
    expect(validateAvatarRegistry(AVATAR_REGISTRY)).toEqual({ ok: true, errors: [] })
  })

  it('uses safe root-relative production paths', () => {
    for (const entry of AVATAR_REGISTRY) {
      expect(isSafeAvatarSrc(entry.src)).toBe(true)
      expect(entry.src).toMatch(/^\/avatars\/avatar-\d{2}\.png$/)
    }
  })

  it('references existing production avatar files', async () => {
    await Promise.all(AVATAR_REGISTRY.map((entry) => access(publicPathFor(entry.src))))
  })

  it('rejects unknown avatar keys without falling back to a fixture key', () => {
    expect(isApprovedAvatarKey('avatar-01')).toBe(true)
    expect(isApprovedAvatarKey('unknown-avatar')).toBe(false)
    expect(isApprovedAvatarKey('fixture-avatar-a')).toBe(false)
  })

  it('keeps fixture keys out of the production registry', () => {
    expect(avatarKeyAllowlist()).not.toContain('fixture-avatar-a')
    expect(avatarKeyAllowlist()).not.toContain('fixture-avatar-b')
  })

  it('accepts fixture-only entries only when tests pass them explicitly', () => {
    expect(validateAvatarRegistry(fixtureAvatarRegistry)).toEqual({ ok: true, errors: [] })
    expect(avatarKeyAllowlist(fixtureAvatarRegistry)).toEqual(['fixture-avatar-a', 'fixture-avatar-b'])
  })

  it('rejects duplicate keys', () => {
    const result = validateAvatarRegistry([
      AVATAR_REGISTRY[0],
      { ...AVATAR_REGISTRY[1], key: AVATAR_REGISTRY[0].key },
    ])

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toMatch(/duplicated/i)
  })

  it.each([
    'avatars/no-leading-slash.png',
    '/images/avatar.png',
    '/avatars/../secret.png',
    '/avatars\\secret.png',
    '/avatars//avatar.png',
    '/avatars/avatar.png?cache=1',
    '/avatars/avatar.png#fragment',
  ])('rejects unsafe avatar src path %s', (src) => {
    expect(isSafeAvatarSrc(src)).toBe(false)
    expect(validateAvatarRegistry([{ ...AVATAR_REGISTRY[0], src }]).ok).toBe(false)
  })
})

describe('PocketBase/shared avatar manifest parity seam', () => {
  it('exposes the same 10 production entries in both runtimes from the canonical source', () => {
    expect(AVATAR_REGISTRY).toEqual(expectedProductionRegistry)
    expect(pocketBaseAvatarManifest.AVATAR_MANIFEST).toEqual(expectedProductionRegistry)
    expect(pocketBaseAvatarManifest.AVATAR_MANIFEST).toEqual(AVATAR_REGISTRY)
    expect(pocketBaseAvatarManifest.avatarKeyAllowlist(pocketBaseAvatarManifest.AVATAR_MANIFEST)).toEqual(productionKeys)
  })

  it('rejects the same duplicate-key and unsafe-path manifests in both runtimes', () => {
    const invalidManifests = [
      [AVATAR_REGISTRY[0], { ...AVATAR_REGISTRY[1], key: AVATAR_REGISTRY[0].key }],
      [{ ...AVATAR_REGISTRY[0], src: '/avatars/../secret.png' }],
    ]

    for (const manifest of invalidManifests) {
      expect(validateAvatarRegistry(manifest).ok).toBe(false)
      expect(pocketBaseAvatarManifest.validateAvatarManifest(manifest).ok).toBe(false)
      expect(pocketBaseAvatarManifest.avatarKeyAllowlist(manifest)).toEqual([])
    }
  })

  it('uses the same root-relative path safety rule in both runtimes', () => {
    expect(pocketBaseAvatarManifest.isSafeAvatarSrc('/avatars/avatar-01.png')).toBe(true)
    expect(pocketBaseAvatarManifest.isSafeAvatarSrc('/avatars/../secret.png')).toBe(false)
    expect(pocketBaseAvatarManifest.isSafeAvatarSrc('/images/avatar.png')).toBe(false)
  })

  it('generates avatar artifacts idempotently', () => {
    const before = generatedAvatarFiles.map((file) => readFileSync(file, 'utf8'))
    execFileSync('pnpm', ['generate:avatars'], { stdio: 'pipe' })
    const after = generatedAvatarFiles.map((file) => readFileSync(file, 'utf8'))
    expect(after).toEqual(before)
  })
})
