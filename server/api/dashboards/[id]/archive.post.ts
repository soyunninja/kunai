import { defineEventHandler } from 'h3'

import { archiveDashboard, dashboardContext, handleDashboardError } from '../_shared'

export default defineEventHandler(async (event) => {
  try {
    return await archiveDashboard(await dashboardContext(event, { mutation: true }))
  } catch (error) {
    return handleDashboardError(event, error)
  }
})
