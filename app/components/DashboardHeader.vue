<script setup lang="ts">
import { computed } from 'vue'

import { AVATAR_REGISTRY } from '../../shared/avatars'
import type { SafeSessionDto } from '../../shared/types/auth'
import type { DashboardTabDto } from '../../shared/types/dashboard'
import DashboardTabs from './DashboardTabs.vue'

const props = defineProps<{
  readonly session: SafeSessionDto
  readonly dashboards: readonly DashboardTabDto[]
  readonly activeDashboardId: string | null
  readonly logoutPending: boolean
}>()

const emit = defineEmits<{
  selectDashboard: [dashboardId: string]
  logout: []
}>()

const avatar = computed(() => (
  AVATAR_REGISTRY.find((entry) => entry.key === props.session.avatarKey)
  ?? AVATAR_REGISTRY[0]
))
</script>

<template>
  <header data-testid="dashboard-header" class="border-b border-[var(--foundation-border)] pt-2">
    <div class="flex flex-col gap-2">
      <div class="flex min-h-8 items-center gap-3">
        <div data-testid="product-identity" class="shrink-0 font-mono text-lg font-semibold lowercase tracking-[-0.04em] text-current md:text-xl">
          kunai
        </div>

        <div class="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-xs text-[var(--foundation-muted)]">
          <button
            data-testid="settings-entry"
            type="button"
            class="px-2 py-1 transition hover:text-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            aria-label="Open settings"
          >
            Settings
          </button>
          <button
            data-testid="manage-dashboards"
            type="button"
            class="px-2 py-1 transition hover:text-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            aria-label="Manage dashboards"
          >
            Manage
          </button>
          <div data-testid="user-identity" class="flex items-center gap-1.5 px-1.5 py-1 text-current">
            <img
              v-if="avatar"
              :src="avatar.src"
              :alt="avatar.label"
              width="24"
              height="24"
              class="size-6 [image-rendering:pixelated]"
            >
            <span class="max-w-32 truncate">{{ session.displayName }}</span>
          </div>
          <button
            data-testid="logout"
            type="button"
            class="px-2 py-1 transition hover:text-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:pointer-events-none disabled:opacity-60"
            :disabled="logoutPending"
            @click="emit('logout')"
          >
            {{ logoutPending ? 'Logging out…' : 'Log out' }}
          </button>
        </div>
      </div>

      <DashboardTabs
        class="min-w-0"
        :dashboards="dashboards"
        :active-dashboard-id="activeDashboardId"
        @select="emit('selectDashboard', $event)"
      />
    </div>
  </header>
</template>
