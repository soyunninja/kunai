/// <reference path="../pb_data/types.d.ts" />
/* global $os, DateField, RelationField, migrate */

const escapeFilterValue = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const findRecords = (app, collection, filter, limit) => app.findRecordsByFilter(collection, filter, '', limit, 0)

const validHomeForPreference = (app, ownerId) => {
  const homes = findRecords(
    app,
    'dashboards',
    `owner = "${escapeFilterValue(ownerId)}" && seedKey = "home"`,
    2,
  )

  if (homes.length !== 1) return null

  const home = homes[0]
  if (home.getString('owner') !== ownerId || home.getString('name') !== 'Home' || home.getInt('sortOrder') !== 0) {
    return null
  }

  return home
}

migrate((app) => {
  const dashboards = app.findCollectionByNameOrId('dashboards')
  const preferences = app.findCollectionByNameOrId('user_preferences')

  dashboards.fields.add(new DateField({ name: 'archivedAt' }))
  dashboards.deleteRule = null
  app.save(dashboards)

  preferences.fields.add(new RelationField({ name: 'activeDashboard', collectionId: dashboards.id, maxSelect: 1 }))
  app.save(preferences)

  const existingPreferences = app.findAllRecords('user_preferences')
  for (const preference of existingPreferences) {
    const ownerId = preference.getString('owner')
    const home = validHomeForPreference(app, ownerId)
    if (!home) continue

    preference.set('activeDashboard', home.id)
    app.save(preference)
  }
}, (app) => {
  if ($os.getenv('KUNAI_ALLOW_DESTRUCTIVE_MIGRATION_DOWN') !== '1') {
    throw new Error('Refusing Phase 0003 lifecycle rollback without KUNAI_ALLOW_DESTRUCTIVE_MIGRATION_DOWN=1')
  }

  const preferences = app.findCollectionByNameOrId('user_preferences')
  preferences.fields.removeByName('activeDashboard')
  app.save(preferences)

  const dashboards = app.findCollectionByNameOrId('dashboards')
  dashboards.fields.removeByName('archivedAt')
  dashboards.deleteRule = 'owner = @request.auth.id'
  app.save(dashboards)
})
