/// <reference path="../pb_data/types.d.ts" />
/* global __hooks, onBootstrap, onRecordUpdateRequest */

onBootstrap((e) => {
  e.next()
  const { assertBatchPreflight } = require(__hooks + '/lib/batch-preflight.js')
  assertBatchPreflight(e.app)
})

onRecordUpdateRequest((e) => {
  const info = e.requestInfo()
  if (!info.auth || info.auth.isSuperuser()) {
    e.next()
    return
  }

  if (e.record.id !== info.auth.id) {
    throw new Error('Users may only update their own profile.')
  }

  const previous = e.record.original()
  const wasCompleted = previous.getBool('onboardingCompleted')
  const isCompleted = e.record.getBool('onboardingCompleted')

  if (wasCompleted) {
    throw new Error('Completed onboarding profiles are immutable.')
  }

  if (!isCompleted) {
    e.record.set('onboardingCompletedAt', '')
    e.next()
    return
  }

  const { assertCompletionPredicate } = require(__hooks + '/lib/onboarding-validation.js')
  assertCompletionPredicate(e.app, e.record)
  e.record.set('onboardingCompletedAt', new Date().toISOString())
  e.next()
}, 'users')
