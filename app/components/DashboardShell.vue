<script setup lang="ts">
import type { SafeSessionDto } from '../../shared/types/auth'
import type { DashboardTabDto } from '../../shared/types/dashboard'
import DashboardEmptyState from './DashboardEmptyState.vue'
import DashboardHeader from './DashboardHeader.vue'

defineProps<{
  readonly session: SafeSessionDto
  readonly dashboards: readonly DashboardTabDto[]
  readonly activeDashboard: DashboardTabDto | null
  readonly activeDashboardId: string | null
  readonly logoutPending: boolean
}>()

const emit = defineEmits<{
  selectDashboard: [dashboardId: string]
  logout: []
}>()
</script>

<template>
  <main
    data-testid="dashboard-shell"
    data-visual-tone="terminal-dark"
    data-density="compact"
    data-layout="responsive-dashboard-tabs"
    data-font-intent="monospace"
    data-cache="private-no-store"
    class="min-h-[calc(100vh-5rem)] w-full bg-[var(--foundation-background)] px-3 py-2 font-mono text-[var(--foundation-text)] md:px-5 md:py-3"
    aria-label="Dashboard shell"
  >
    <p class="sr-only">Private dashboard state loaded.</p>
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-0">
      <DashboardHeader
        :session="session"
        :dashboards="dashboards"
        :active-dashboard-id="activeDashboardId"
        :logout-pending="logoutPending"
        @select-dashboard="emit('selectDashboard', $event)"
        @logout="emit('logout')"
      />

      <section class="pt-3" aria-live="polite">
        <DashboardEmptyState :dashboard="activeDashboard" />
      </section>
    </div>
  </main>
</template>
