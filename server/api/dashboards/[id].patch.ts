import { defineEventHandler } from 'h3'

import { dashboardContext, handleDashboardError, renameDashboard } from './_shared'

export default defineEventHandler(async (event) => {
  try {
    return await renameDashboard(await dashboardContext(event, { mutation: true }))
  } catch (error) {
    return handleDashboardError(event, error)
  }
})
