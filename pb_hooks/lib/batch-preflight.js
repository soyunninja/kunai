const REQUIRED_BATCH_REQUESTS = 4

const batchPreflightMessage = 'PocketBase batch API must be enabled with batch.maxRequests >= 4 for Phase 0002 onboarding completion.'

const assertBatchPreflight = (app) => {
  const settings = app.settings()
  if (!settings.batch || settings.batch.enabled !== true || settings.batch.maxRequests < REQUIRED_BATCH_REQUESTS) {
    throw new Error(batchPreflightMessage)
  }
}

module.exports = {
  REQUIRED_BATCH_REQUESTS,
  batchPreflightMessage,
  assertBatchPreflight,
}
