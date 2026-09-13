/* global __hooks */
const { avatarKeyAllowlist, AVATAR_MANIFEST } = require(`${__hooks}/lib/avatar-manifest.js`)
const { IANA_TIMEZONES } = require(`${__hooks}/lib/timezone-manifest.js`)

const requiredSeedKeys = ['search', 'clock', 'weather', 'bookmarks']
const approvedAvatarKeys = avatarKeyAllowlist(AVATAR_MANIFEST)
const approvedTimezoneKeys = new Set(IANA_TIMEZONES)

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const valueAt = (value, key) => isObject(value) ? value[key] : undefined

const normalizeJson = (value) => {
  const text = Array.isArray(value) && value.every((item) => Number.isInteger(item))
    ? String.fromCharCode(...value)
    : value
  if (typeof text !== 'string') return text
  if (text === '') return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const raw = (record, field) => normalizeJson(record.getRaw(field))

const relationId = (value) => {
  if (Array.isArray(value)) return relationId(value[0])
  if (typeof value === 'string') return value
  if (isObject(value) && typeof value.id === 'string') return value.id
  return ''
}

const singleValue = (record, field) => {
  const value = raw(record, field)
  if (Array.isArray(value)) return singleValue({ getRaw: () => value[0], getString: () => '' }, '')
  if (typeof value === 'string') return value
  return record.getString(field)
}

const singleRelationId = (record, field) => relationId(raw(record, field)) || record.getString(field)

const isEmptyJsonValue = (value) => value === null || value === '' || (Array.isArray(value) && value.length === 0)

const locationEquals = (left, right) => {
  if (isEmptyJsonValue(left)) return isEmptyJsonValue(right)
  if (isEmptyJsonValue(right)) return false
  if (!isObject(left) || !isObject(right)) return false
  if (left.kind !== right.kind || left.label !== right.label) return false
  if (left.kind === 'label') return Object.keys(left).length === 2 && Object.keys(right).length === 2
  return left.kind === 'coordinates'
    && Object.keys(left).length === 4
    && Object.keys(right).length === 4
    && left.latitude === right.latitude
    && left.longitude === right.longitude
}

const locationIsValid = (location) => {
  if (isEmptyJsonValue(location)) return true
  if (!isObject(location) || typeof location.kind !== 'string' || typeof location.label !== 'string' || location.label.trim() !== location.label || location.label.length === 0 || location.label.length > 120) return false
  if (location.kind === 'label') return Object.keys(location).length === 2
  return location.kind === 'coordinates'
    && Object.keys(location).length === 4
    && Number.isFinite(location.latitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && Number.isFinite(location.longitude)
    && location.longitude >= -180
    && location.longitude <= 180
}

const timezoneIsValid = (timezone) => typeof timezone === 'string' && approvedTimezoneKeys.has(timezone)

const profileIsValid = (record) => {
  const displayName = record.getString('displayName')
  const avatarKey = record.getString('avatarKey')
  const timezone = record.getString('timezone')
  return displayName.length > 0
    && displayName.length <= 80
    && displayName === displayName.trim()
    && approvedAvatarKeys.includes(avatarKey)
    && timezoneIsValid(timezone)
}

const emptyJson = isEmptyJsonValue

const records = (app, collection, filter) => app.findRecordsByFilter(collection, filter, '', 10, 0)
const filterString = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const fail = (message) => {
  throw new Error(message)
}

const widgetIsValid = (widget, user, dashboardId, preferenceLocation) => {
  const seedKey = widget.getString('seedKey')
  if (!requiredSeedKeys.includes(seedKey)
    || singleRelationId(widget, 'owner') !== user.id
    || singleRelationId(widget, 'dashboard') !== dashboardId
    || widget.getString('type') !== seedKey
    || !emptyJson(raw(widget, 'layoutDesktop'))
    || !emptyJson(raw(widget, 'layoutTablet'))
    || !emptyJson(raw(widget, 'layoutMobile'))) return false

  const config = raw(widget, 'config')
  if (!isObject(config)) return false
  if (seedKey === 'search') return valueAt(config, 'engine') === 'google' && valueAt(config, 'placeholder') === null && Object.keys(config).length === 2
  if (seedKey === 'clock') return valueAt(config, 'mode') === 'local' && valueAt(config, 'timezone') === user.getString('timezone') && Object.keys(config).length === 2
  if (seedKey === 'weather') return locationEquals(valueAt(config, 'location'), preferenceLocation) && Object.keys(config).length === 1
  return Array.isArray(valueAt(config, 'items')) && valueAt(config, 'items').length === 0 && Object.keys(config).length === 1
}

const assertCompletionPredicate = (app, user) => {
  if (!profileIsValid(user)) fail('Onboarding profile is incomplete.')

  const ownerId = filterString(user.id)
  const preferences = records(app, 'user_preferences', `owner = "${ownerId}"`)
  if (preferences.length !== 1) fail('Onboarding preferences are incomplete.')
  const preference = preferences[0]
  const location = raw(preference, 'defaultLocation')
  const appearance = singleValue(preference, 'appearance')
  if (singleRelationId(preference, 'owner') !== user.id || !['dark', 'light', 'system'].includes(appearance) || !locationIsValid(location)) fail('Onboarding preferences are invalid.')

  const homes = records(app, 'dashboards', `owner = "${ownerId}" && seedKey = "home"`)
  if (homes.length !== 1) fail('Onboarding Home seed is incomplete.')
  const home = homes[0]
  if (singleRelationId(home, 'owner') !== user.id || home.getString('name') !== 'Home' || home.getInt('sortOrder') !== 0) fail('Onboarding Home seed is invalid.')

  const widgets = records(app, 'dashboard_widgets', `dashboard = "${filterString(home.id)}"`)
  if (widgets.length !== 4) fail('Onboarding widget seed is incomplete.')
  const seen = new Set()
  for (const widget of widgets) {
    const seedKey = widget.getString('seedKey')
    if (seen.has(seedKey) || !widgetIsValid(widget, user, home.id, location)) fail(`Onboarding widget seed is invalid: ${seedKey}`)
    seen.add(seedKey)
  }
  if (seen.size !== requiredSeedKeys.length) fail('Onboarding widget seed is incomplete.')
}

module.exports = { assertCompletionPredicate, timezoneIsValid }
