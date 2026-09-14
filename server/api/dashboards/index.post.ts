import { defineEventHandler } from 'h3'

import { createDashboard, dashboardContext, handleDashboardError } from './_shared'

export default defineEventHandler(async (event) => {
  try {
    return await createDashboard(await dashboardContext(event, { mutation: true }))
  } catch (error) {
    return handleDashboardError(event, error)
  }
})
