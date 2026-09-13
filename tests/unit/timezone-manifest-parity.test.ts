import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

import { IANA_TIMEZONES } from '../../shared/generated/timezones'
import { parseOnboardingCompletionInput } from '../../shared/validation/onboarding'

const require = createRequire(import.meta.url)
const pocketBaseTimezoneManifest = require('../../pb_hooks/lib/timezone-manifest.js') as {
  readonly IANA_TIMEZONES: readonly string[]
}

Object.assign(globalThis, { __hooks: `${process.cwd()}/pb_hooks` })
const pocketBaseOnboardingValidation = require('../../pb_hooks/lib/onboarding-validation.js') as {
  readonly timezoneIsValid: (timezone: unknown) => boolean
}

const timezoneFiles = [
  'shared/generated/timezones.ts',
  'pb_hooks/lib/timezone-manifest.js',
] as const

const fixtureAvatarKeys = ['fixture-avatar-a'] as const

const parseTimezone = (timezone: string) => parseOnboardingCompletionInput({
  displayName: 'Ada Lovelace',
  avatarKey: 'fixture-avatar-a',
  timezone,
  defaultLocation: null,
}, { allowedAvatarKeys: fixtureAvatarKeys })

describe('generated timezone manifest parity', () => {
  it('exposes exactly the same timezone identifiers in shared and PocketBase artifacts', () => {
    expect(pocketBaseTimezoneManifest.IANA_TIMEZONES).toEqual(IANA_TIMEZONES)
  })

  it('has deterministic unique timezone identifiers', () => {
    expect(new Set(IANA_TIMEZONES).size).toBe(IANA_TIMEZONES.length)
    expect([...IANA_TIMEZONES].sort((left, right) => left.localeCompare(right, 'en-US'))).toEqual(IANA_TIMEZONES)
  })

  it.each(['America/New_York', 'Europe/Madrid', 'Asia/Tokyo'])('accepts %s in shared and PocketBase validation', (timezone) => {
    expect(parseTimezone(timezone).timezone).toBe(timezone)
    expect(pocketBaseOnboardingValidation.timezoneIsValid(timezone)).toBe(true)
  })

  it('rejects invalid timezone identifiers in shared and PocketBase validation', () => {
    expect(() => parseTimezone('Mars/Olympus_Mons')).toThrow(/timezone/i)
    expect(pocketBaseOnboardingValidation.timezoneIsValid('Mars/Olympus_Mons')).toBe(false)
  })

  it('generates timezone artifacts idempotently', () => {
    const before = timezoneFiles.map((file) => readFileSync(file, 'utf8'))
    execFileSync('pnpm', ['generate:timezones'], { stdio: 'pipe' })
    const after = timezoneFiles.map((file) => readFileSync(file, 'utf8'))
    expect(after).toEqual(before)
  })
})
