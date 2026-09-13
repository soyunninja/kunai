import { afterEach, describe, expect, it } from 'vitest'

import {
  applyMigrations,
  configureDisposableBatchSettings,
  createPocketBaseHarness,
  startPocketBase,
  stopPocketBase,
  type PocketBaseHarness,
} from './support/harness'

const preflightMessage = 'PocketBase batch API must be enabled with batch.maxRequests >= 4 for Phase 0002 onboarding completion.'

describe('Phase 0002 PocketBase batch operational preflight', () => {
  let harness: PocketBaseHarness | null = null

  afterEach(async () => {
    if (harness) {
      await stopPocketBase(harness)
      harness = null
    }
  })

  it('fails fast when the global PocketBase batch API is disabled', async () => {
    harness = await createPocketBaseHarness()
    configureDisposableBatchSettings(harness, { enabled: false, maxRequests: 4 })
    applyMigrations(harness, { configureBatch: false })

    await expect(startPocketBase(harness)).rejects.toThrow(preflightMessage)
  }, 180_000)

  it('fails fast when the global PocketBase batch maxRequests is below the onboarding requirement', async () => {
    harness = await createPocketBaseHarness()
    configureDisposableBatchSettings(harness, { enabled: true, maxRequests: 3 })
    applyMigrations(harness, { configureBatch: false })

    await expect(startPocketBase(harness)).rejects.toThrow(preflightMessage)
  }, 180_000)

  it('accepts global PocketBase batch maxRequests greater than the four-operation onboarding batch', async () => {
    harness = await createPocketBaseHarness()
    configureDisposableBatchSettings(harness, { enabled: true, maxRequests: 5 })
    applyMigrations(harness, { configureBatch: false })

    await expect(startPocketBase(harness)).resolves.toBeUndefined()
  }, 180_000)
})
