import { defineEventHandler } from 'h3'

import { dashboardContext, dashboardShell, handleDashboardError } from './_shared'

export default defineEventHandler(async (event) => {
  try {
    return await dashboardShell(await dashboardContext(event, { mutation: false }))
  } catch (error) {
    return handleDashboardError(event, error)
  }
})
