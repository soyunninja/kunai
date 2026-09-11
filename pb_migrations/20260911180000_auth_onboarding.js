/// <reference path="../pb_data/types.d.ts" />
/* global $os, BoolField, Collection, DateField, JSONField, NumberField, RelationField, SelectField, TextField, migrate */

const COLLECTIONS = ['dashboard_widgets', 'dashboards', 'user_preferences']

const removeCollectionIfExists = (app, name) => {
  try {
    app.delete(app.findCollectionByNameOrId(name))
  } catch {
    return
  }
}

migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  users.fields.add(
    new TextField({ name: 'displayName', max: 80 }),
    new TextField({ name: 'avatarKey', max: 80 }),
    new TextField({ name: 'timezone', max: 100 }),
    new BoolField({ name: 'onboardingCompleted' }),
    new DateField({ name: 'onboardingCompletedAt' }),
  )
  users.viewRule = 'id = @request.auth.id'
  users.updateRule = 'id = @request.auth.id'
  app.save(users)

  const preferences = new Collection({ type: 'base', name: 'user_preferences' })
  preferences.fields.add(
    new RelationField({ name: 'owner', collectionId: users.id, required: true, maxSelect: 1 }),
    new SelectField({ name: 'appearance', values: ['dark', 'light', 'system'], maxSelect: 1 }),
    new JSONField({ name: 'defaultLocation', maxSize: 2048 }),
  )
  preferences.indexes = [
    'CREATE UNIQUE INDEX idx_user_preferences_owner ON user_preferences (owner)',
  ]
  preferences.listRule = 'owner = @request.auth.id'
  preferences.viewRule = 'owner = @request.auth.id'
  preferences.createRule = 'owner = @request.auth.id'
  preferences.updateRule = 'owner = @request.auth.id && @request.body.owner:isset = false'
  preferences.deleteRule = 'owner = @request.auth.id'
  app.save(preferences)

  const dashboards = new Collection({ type: 'base', name: 'dashboards' })
  dashboards.fields.add(
    new RelationField({ name: 'owner', collectionId: users.id, required: true, maxSelect: 1 }),
    new TextField({ name: 'name', required: true, max: 80 }),
    new NumberField({ name: 'sortOrder', onlyInt: true, min: 0 }),
    new TextField({ name: 'seedKey', max: 80 }),
  )
  dashboards.indexes = [
    'CREATE UNIQUE INDEX idx_dashboards_owner_seed ON dashboards (owner, seedKey) WHERE seedKey != ""',
    'CREATE INDEX idx_dashboards_owner ON dashboards (owner)',
  ]
  dashboards.listRule = 'owner = @request.auth.id'
  dashboards.viewRule = 'owner = @request.auth.id'
  dashboards.createRule = 'owner = @request.auth.id'
  dashboards.updateRule = 'owner = @request.auth.id && @request.body.owner:isset = false'
  dashboards.deleteRule = 'owner = @request.auth.id'
  app.save(dashboards)

  const widgets = new Collection({ type: 'base', name: 'dashboard_widgets' })
  widgets.fields.add(
    new RelationField({ name: 'owner', collectionId: users.id, required: true, maxSelect: 1 }),
    new RelationField({ name: 'dashboard', collectionId: dashboards.id, required: true, maxSelect: 1 }),
    new TextField({ name: 'type', required: true, max: 80 }),
    new TextField({ name: 'seedKey', max: 80 }),
    new JSONField({ name: 'config', required: true, maxSize: 4096 }),
    new JSONField({ name: 'layoutDesktop', maxSize: 2048 }),
    new JSONField({ name: 'layoutTablet', maxSize: 2048 }),
    new JSONField({ name: 'layoutMobile', maxSize: 2048 }),
  )
  widgets.indexes = [
    'CREATE UNIQUE INDEX idx_dashboard_widgets_dashboard_seed ON dashboard_widgets (dashboard, seedKey) WHERE seedKey != ""',
    'CREATE INDEX idx_dashboard_widgets_owner_dashboard ON dashboard_widgets (owner, dashboard)',
  ]
  widgets.listRule = 'owner = @request.auth.id'
  widgets.viewRule = 'owner = @request.auth.id'
  widgets.createRule = 'owner = @request.auth.id && dashboard.owner = @request.auth.id'
  widgets.updateRule = 'owner = @request.auth.id && @request.body.owner:isset = false && @request.body.dashboard:isset = false && dashboard.owner = @request.auth.id'
  widgets.deleteRule = 'owner = @request.auth.id'
  app.save(widgets)
}, (app) => {
  if ($os.getenv('KUNAI_ALLOW_DESTRUCTIVE_MIGRATION_DOWN') !== '1') {
    throw new Error('Refusing destructive Phase 0002 rollback without KUNAI_ALLOW_DESTRUCTIVE_MIGRATION_DOWN=1')
  }

  for (const name of COLLECTIONS) {
    removeCollectionIfExists(app, name)
  }

  const users = app.findCollectionByNameOrId('users')
  for (const fieldName of ['displayName', 'avatarKey', 'timezone', 'onboardingCompleted', 'onboardingCompletedAt']) {
    try {
      users.fields.removeByName(fieldName)
    } catch {
      continue
    }
  }
  users.viewRule = null
  users.updateRule = null
  app.save(users)
})
