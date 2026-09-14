const escapeFilterValue = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const records = (app, collection, filter, limit = 2) => app.findRecordsByFilter(collection, filter, '', limit, 0)

const isArchived = (record) => record.getString('archivedAt') !== ''

const assertActiveDashboardReference = (app, preference) => {
  const dashboardId = preference.getString('activeDashboard')
  if (dashboardId === '') return

  const dashboards = records(app, 'dashboards', `id = "${escapeFilterValue(dashboardId)}"`, 1)
  if (dashboards.length !== 1) {
    throw new Error('Active dashboard must reference an existing dashboard.')
  }

  const dashboard = dashboards[0]
  if (dashboard.getString('owner') !== preference.getString('owner')) {
    throw new Error('Active dashboard must belong to the preference owner.')
  }
  if (isArchived(dashboard)) {
    throw new Error('Archived dashboards cannot be active.')
  }
}

const assertDashboardUpdate = (app, dashboard) => {
  const previous = dashboard.original()
  const ownerId = previous.getString('owner')

  if (dashboard.getString('owner') !== ownerId) {
    throw new Error('Dashboard owner cannot be changed.')
  }
  if (dashboard.getString('seedKey') !== previous.getString('seedKey')) {
    throw new Error('Dashboard seed identity cannot be changed.')
  }
  if (isArchived(previous)) {
    throw new Error('Archived dashboards cannot be changed or restored.')
  }
  if (!isArchived(dashboard)) return
  if (previous.getString('seedKey') === 'home') {
    throw new Error('The seeded Home dashboard cannot be archived.')
  }

  const ownerFilter = escapeFilterValue(ownerId)
  const dashboardFilter = escapeFilterValue(dashboard.id)
  if (records(app, 'user_preferences', `owner = "${ownerFilter}" && activeDashboard = "${dashboardFilter}"`, 1).length !== 0) {
    throw new Error('The active dashboard must be changed before archiving this dashboard.')
  }
  if (records(app, 'dashboards', `owner = "${ownerFilter}" && seedKey = "home" && archivedAt = ""`, 1).length !== 1) {
    throw new Error('A protected Home dashboard must remain before archiving another dashboard.')
  }
  if (records(app, 'dashboards', `owner = "${ownerFilter}" && archivedAt = ""`, 2).length < 2) {
    throw new Error('The last active dashboard cannot be archived.')
  }
}

module.exports = { assertActiveDashboardReference, assertDashboardUpdate }
