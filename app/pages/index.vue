<script setup lang="ts">
import { navigateTo } from '#imports'
import { ref } from 'vue'

import DashboardShell from '../components/DashboardShell.vue'
import { useDashboards } from '../composables/useDashboards'
import { useSession } from '../composables/useSession'

const { logout, session } = useSession()
const {
  activeDashboard,
  activeDashboardId,
  dashboards,
  load,
  setActive,
} = useDashboards()

const logoutPending = ref(false)

if (session.value && !session.value.onboardingCompleted) {
  await navigateTo('/onboarding')
} else {
  await load()
}

const handleSelectDashboard = async (dashboardId: string) => {
  await setActive(dashboardId)
}

const handleLogout = async () => {
  if (logoutPending.value) return
  logoutPending.value = true

  try {
    await logout()
    await navigateTo('/login')
  } finally {
    logoutPending.value = false
  }
}
</script>

<template>
  <DashboardShell
    v-if="session"
    :session="session"
    :dashboards="dashboards"
    :active-dashboard="activeDashboard"
    :active-dashboard-id="activeDashboardId"
    :logout-pending="logoutPending"
    @select-dashboard="handleSelectDashboard"
    @logout="handleLogout"
  />
</template>
