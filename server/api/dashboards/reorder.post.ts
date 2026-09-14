import { defineEventHandler } from 'h3'

import { dashboardContext, handleDashboardError, reorderDashboards } from './_shared'

export default defineEventHandler(async (event) => {
  try {
    return await reorderDashboards(await dashboardContext(event, { mutation: true }))
  } catch (error) {
    return handleDashboardError(event, error)
  }
})
