<script setup lang="ts">
import type { DashboardTabDto } from '../../shared/types/dashboard'

const props = defineProps<{
  readonly dashboards: readonly DashboardTabDto[]
  readonly activeDashboardId: string | null
}>()

const emit = defineEmits<{
  create: []
  select: [dashboardId: string]
}>()

const panelId = (dashboardId: string) => `dashboard-panel-${dashboardId}`

const focusTab = (currentIndex: number, direction: 1 | -1) => {
  if (!import.meta.client || props.dashboards.length === 0) return
  const nextIndex = (currentIndex + direction + props.dashboards.length) % props.dashboards.length
  const nextDashboard = props.dashboards[nextIndex]
  if (!nextDashboard) return
  document.querySelector<HTMLButtonElement>(`[data-dashboard-tab-id="${nextDashboard.id}"]`)?.focus()
}

const handleKeydown = (event: KeyboardEvent, dashboard: DashboardTabDto, index: number) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    focusTab(index, 1)
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    focusTab(index, -1)
  } else if (event.key === 'Home') {
    event.preventDefault()
    document.querySelector<HTMLButtonElement>(`[data-dashboard-tab-id="${props.dashboards[0]?.id}"]`)?.focus()
  } else if (event.key === 'End') {
    event.preventDefault()
    document.querySelector<HTMLButtonElement>(`[data-dashboard-tab-id="${props.dashboards.at(-1)?.id}"]`)?.focus()
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('select', dashboard.id)
  }
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-1.5">
    <div
      role="tablist"
      aria-label="Dashboards"
      aria-orientation="horizontal"
      class="inline-flex w-auto max-w-full flex-none items-end gap-0.5 overflow-x-auto overflow-y-hidden border-b border-[var(--foundation-border)]"
    >
      <button
        v-for="(dashboard, index) in dashboards"
        :id="`dashboard-tab-${dashboard.id}`"
        :key="dashboard.id"
        :data-dashboard-tab-id="dashboard.id"
        class="relative -mb-px min-h-9 min-w-fit shrink-0 whitespace-nowrap border border-transparent px-3 py-1.5 text-left font-mono text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        :class="dashboard.id === activeDashboardId
          ? 'border-[var(--foundation-border)] border-b-[var(--foundation-background)] bg-[var(--foundation-background)] text-current shadow-[inset_0_2px_0_currentColor]'
          : 'text-[var(--foundation-muted)] hover:text-current'"
        role="tab"
        type="button"
        :aria-selected="dashboard.id === activeDashboardId"
        :aria-controls="panelId(dashboard.id)"
        :data-active="dashboard.id === activeDashboardId ? 'true' : undefined"
        :tabindex="dashboard.id === activeDashboardId ? 0 : -1"
        @click="emit('select', dashboard.id)"
        @keydown="handleKeydown($event, dashboard, index)"
      >
        {{ dashboard.name }}
      </button>
    </div>

    <button
      data-testid="create-dashboard"
      data-touch-target="comfortable"
      type="button"
      aria-label="Create dashboard"
          title="Create dashboard"
      class="min-h-9 min-w-9 px-2 py-1 font-mono text-base leading-none text-[var(--foundation-muted)] transition hover:text-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      @click="emit('create')"
    >
      +
    </button>
  </div>
</template>
