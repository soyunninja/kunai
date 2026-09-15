<script setup lang="ts">
import type { DashboardTabDto } from '../../shared/types/dashboard'

defineProps<{
  readonly dashboard: DashboardTabDto | null
}>()
</script>

<template>
  <section
    :id="dashboard ? `dashboard-panel-${dashboard.id}` : 'dashboard-panel-empty'"
    data-testid="active-dashboard-empty-state"
    class="min-h-[18rem] font-mono"
    role="tabpanel"
    :aria-labelledby="dashboard ? `dashboard-tab-${dashboard.id}` : undefined"
  >
    <div class="flex min-h-20 items-start">
      <div class="flex items-center gap-2 text-sm text-[var(--foundation-muted)]">
        <span aria-hidden="true" class="block size-1.5 rounded-full bg-current opacity-70" />
        <p data-testid="home-name" class="m-0">{{ dashboard?.name ?? 'Home' }} is empty.</p>
      </div>
    </div>
  </section>
</template>
