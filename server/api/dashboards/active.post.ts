import { defineEventHandler } from 'h3'

import { dashboardContext, handleDashboardError, setActiveDashboard } from './_shared'

export default defineEventHandler(async (event) => {
  try {
    return await setActiveDashboard(await dashboardContext(event, { mutation: true }))
  } catch (error) {
    return handleDashboardError(event, error)
  }
})
