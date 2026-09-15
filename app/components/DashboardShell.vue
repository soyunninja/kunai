<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import type { SafeSessionDto } from '../../shared/types/auth'
import type { DashboardTabDto } from '../../shared/types/dashboard'
import { useDashboards } from '../composables/useDashboards'
import { useTheme, type ThemeMode } from '../composables/useTheme'
import DashboardEmptyState from './DashboardEmptyState.vue'
import DashboardHeader from './DashboardHeader.vue'

const props = defineProps<{
  readonly session: SafeSessionDto
  readonly dashboards: readonly DashboardTabDto[]
  readonly activeDashboard: DashboardTabDto | null
  readonly activeDashboardId: string | null
  readonly logoutPending: boolean
}>()

const emit = defineEmits<{
  logout: []
}>()

const {
  archiveDashboard,
  createDashboard,
  error,
  renameDashboard,
  reorderDashboards,
  setActive,
} = useDashboards()

const themeOptions: ReadonlyArray<{ label: string, value: ThemeMode }> = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
]

const { mode } = useTheme()
const settingsOpen = ref(false)
const createOpen = ref(false)
const createName = ref('')
const createError = ref('')
const createPending = ref(false)
const tabError = ref('')
const manageOpen = ref(false)
const renameTarget = ref<DashboardTabDto | null>(null)
const renameName = ref('')
const renameError = ref('')
const renamePending = ref(false)
const reorderError = ref('')
const reorderPending = ref(false)
const archiveTarget = ref<DashboardTabDto | null>(null)
const archiveError = ref('')
const archivePending = ref(false)
const lifecycleOperation = ref<'tab' | 'reorder' | null>(null)

const failureMessage = () => error.value || 'Dashboard changes could not be saved. Retry.'

let previousBodyOverflow: string | null = null

const restoreBodyScroll = () => {
  if (!import.meta.client || previousBodyOverflow === null) return
  document.body.style.overflow = previousBodyOverflow
  previousBodyOverflow = null
}

watch(
  () => settingsOpen.value || createOpen.value || manageOpen.value || Boolean(renameTarget.value) || Boolean(archiveTarget.value),
  (hasOpenDialog) => {
    if (!import.meta.client) return

    if (hasOpenDialog) {
      previousBodyOverflow ??= document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return
    }

    restoreBodyScroll()
  },
)

onBeforeUnmount(restoreBodyScroll)

watch(() => props.dashboards, (nextDashboards) => {
  if (archiveTarget.value && !nextDashboards.some((dashboard) => dashboard.id === archiveTarget.value?.id)) {
    closeArchive()
  }
})

watch(error, (message) => {
  if (!message) return
  if (lifecycleOperation.value === 'tab') tabError.value = message
  if (lifecycleOperation.value === 'reorder') reorderError.value = message
}, { flush: 'sync' })

const openSettings = () => {
  settingsOpen.value = true
}

const openCreate = () => {
  createError.value = ''
  createOpen.value = true
}

const submitCreate = async () => {
  const name = createName.value.trim()
  if (!name) {
    createError.value = 'Dashboard name is required.'
    return
  }

  createPending.value = true
  createError.value = ''
  const nextShell = await createDashboard(name)
  createPending.value = false

  if (!nextShell) {
    createError.value = failureMessage()
    return
  }

  createName.value = ''
  createOpen.value = false
}

const selectDashboard = async (dashboardId: string) => {
  lifecycleOperation.value = 'tab'
  tabError.value = ''
  const nextShell = await setActive(dashboardId)
  if (!nextShell) {
    tabError.value = failureMessage()
  }
  lifecycleOperation.value = null
}

const openManage = () => {
  reorderError.value = ''
  manageOpen.value = true
}

const openRename = (dashboard: DashboardTabDto) => {
  renameTarget.value = dashboard
  renameName.value = dashboard.name
  renameError.value = ''
}

const closeRename = () => {
  renameTarget.value = null
  renameError.value = ''
}

const submitRename = async () => {
  const target = renameTarget.value
  const name = renameName.value.trim()
  if (!target) return
  if (!name) {
    renameError.value = 'Dashboard name is required.'
    return
  }

  renamePending.value = true
  renameError.value = ''
  const nextShell = await renameDashboard(target.id, name)
  renamePending.value = false

  if (!nextShell) {
    renameError.value = failureMessage()
    return
  }

  closeRename()
}

const moveDashboard = async (index: number, direction: 1 | -1) => {
  const destination = index + direction
  if (reorderPending.value || destination < 0 || destination >= props.dashboards.length) return

  const dashboardIds = props.dashboards.map((dashboard) => dashboard.id)
  const currentId = dashboardIds[index]
  const destinationId = dashboardIds[destination]
  if (!currentId || !destinationId) return

  dashboardIds[index] = destinationId
  dashboardIds[destination] = currentId
  lifecycleOperation.value = 'reorder'
  reorderPending.value = true
  reorderError.value = ''
  const nextShell = await reorderDashboards(dashboardIds)
  reorderPending.value = false

  if (!nextShell) {
    reorderError.value = failureMessage()
  }
  lifecycleOperation.value = null
}

const canArchive = (dashboard: DashboardTabDto) => !dashboard.isHome && props.dashboards.length > 1

const openArchive = (dashboard: DashboardTabDto) => {
  if (!canArchive(dashboard)) return
  archiveTarget.value = dashboard
  archiveError.value = ''
}

const closeArchive = () => {
  archiveTarget.value = null
  archiveError.value = ''
}

const submitArchive = async () => {
  const target = archiveTarget.value
  if (!target || !canArchive(target)) return

  archivePending.value = true
  archiveError.value = ''
  const nextShell = await archiveDashboard(target.id)
  archivePending.value = false

  if (!nextShell) {
    archiveError.value = failureMessage()
    return
  }

  closeArchive()
}
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
        @create-dashboard="openCreate"
        @open-settings="openSettings"
        @manage-dashboards="openManage"
        @select-dashboard="selectDashboard"
        @logout="emit('logout')"
      />

      <p
        v-if="tabError"
        data-testid="dashboard-tab-error"
        role="alert"
        class="mt-2 text-sm text-[var(--foundation-muted)]"
      >
        {{ tabError }}
      </p>

      <section class="pt-3" aria-live="polite">
        <DashboardEmptyState :dashboard="activeDashboard" />
      </section>
    </div>

    <div
      v-if="settingsOpen"
      data-testid="settings-overlay"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 px-3 py-6 backdrop-blur-[1px] md:px-5"
    >
      <section
        data-testid="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-heading"
        class="w-full max-w-md border border-[var(--foundation-border)] bg-[var(--foundation-background)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      >
        <div class="flex items-center justify-between gap-3">
          <h2 id="settings-heading" class="m-0 text-sm font-semibold">Settings</h2>
          <button
            data-testid="settings-close"
            type="button"
            aria-label="Close settings"
            title="Close settings"
            class="min-h-9 px-2 text-lg leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            @click="settingsOpen = false"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <section aria-labelledby="appearance-heading" class="mt-3 border-t border-[var(--foundation-border)] pt-3">
          <h3 id="appearance-heading" class="m-0 text-sm font-semibold">Appearance</h3>
          <label for="appearance" class="mt-2 grid gap-1 text-sm">
            <span class="sr-only">Appearance</span>
            <select
              id="appearance"
              v-model="mode"
              data-testid="appearance-select"
              name="appearance"
              class="min-h-9 border border-[var(--foundation-border)] bg-transparent px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              <option v-for="option in themeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </section>
      </section>
    </div>

    <div
      v-if="createOpen"
      data-testid="dashboard-create-overlay"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 px-3 py-6 backdrop-blur-[1px] md:px-5"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Create dashboard"
        class="w-full max-w-md border border-[var(--foundation-border)] bg-[var(--foundation-background)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="m-0 text-sm font-semibold">Create dashboard</h2>
          <button data-testid="dashboard-create-cancel" type="button" :disabled="createPending" aria-label="Cancel create dashboard" title="Cancel create dashboard" class="min-h-9 px-2 text-lg leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-50" @click="createOpen = false"><span aria-hidden="true">×</span></button>
        </div>
        <form class="mt-3 grid gap-2" @submit.prevent="submitCreate">
          <label for="dashboard-create-name" class="text-sm">Name</label>
          <input
            id="dashboard-create-name"
            v-model="createName"
            data-testid="dashboard-create-name"
            name="name"
            type="text"
            autocomplete="off"
            :disabled="createPending"
            aria-describedby="dashboard-create-error"
            class="min-h-9 border border-[var(--foundation-border)] bg-transparent px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
          <p v-if="createError" id="dashboard-create-error" data-testid="dashboard-create-error" role="alert" class="m-0 text-sm text-[var(--foundation-muted)]">
            {{ createError }}
          </p>
          <div class="flex gap-2">
            <button data-testid="dashboard-create-submit" type="button" :disabled="createPending" :aria-busy="createPending" :aria-label="createPending ? 'Creating dashboard' : 'Create dashboard'" :title="createPending ? 'Creating dashboard' : 'Create dashboard'" class="min-h-9 border border-[var(--foundation-border)] px-3 text-lg leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" @click="submitCreate">
              <span aria-hidden="true">{{ createPending ? '…' : '+' }}</span>
            </button>
            <button v-if="createError && createName.trim()" data-testid="dashboard-create-retry" type="button" :disabled="createPending" aria-label="Retry create dashboard" title="Retry create dashboard" class="min-h-9 px-3 text-lg leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" @click="submitCreate">
              <span aria-hidden="true">↻</span>
            </button>
          </div>
        </form>
      </section>
    </div>

    <div
      v-if="manageOpen && !renameTarget && !archiveTarget"
      data-testid="dashboard-manage-overlay"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 px-3 py-6 backdrop-blur-[1px] md:px-5"
    >
      <section
        data-testid="dashboard-management-panel"
        data-touch-target="comfortable"
        role="dialog"
        aria-modal="true"
        aria-label="Manage dashboards"
        aria-describedby="dashboard-management-help"
        class="max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-y-auto border border-[var(--foundation-border)] bg-[var(--foundation-background)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="m-0 text-sm font-semibold">Manage dashboards</h2>
          <button type="button" aria-label="Close dashboard manager" title="Close dashboard manager" class="min-h-9 px-2 text-lg leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" @click="manageOpen = false"><span aria-hidden="true">×</span></button>
        </div>
        <p id="dashboard-management-help" class="mt-2 text-sm text-[var(--foundation-muted)]">
          Use buttons with keyboard or touch to rename, move, or archive dashboards.
        </p>
        <p v-show="reorderError" data-testid="dashboard-reorder-error" role="alert" class="text-sm text-[var(--foundation-muted)]">{{ reorderError || 'Retry.' }}</p>
        <ul class="m-0 grid list-none gap-2 p-0">
          <li
            v-for="(dashboard, index) in dashboards"
            :key="dashboard.id"
            :data-testid="`dashboard-row-${dashboard.id}`"
            class="flex items-center gap-3 border-t border-[var(--foundation-border)] py-2"
          >
            <span class="min-w-24 text-sm">{{ dashboard.name }}</span>
            <span v-if="!dashboard.isHome && dashboards.length === 1" class="text-xs text-[var(--foundation-muted)]">The last dashboard cannot be archived.</span>
            <div class="ml-auto flex items-center gap-2">
              <button data-testid="dashboard-rename-open" type="button" :aria-label="`Rename ${dashboard.name}`" :title="`Rename ${dashboard.name}`" class="min-h-10 px-3 !text-2xl leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" @click="openRename(dashboard)"><span aria-hidden="true">✎</span></button>
              <button data-testid="dashboard-move-up" type="button" :disabled="index === 0 || reorderPending" :aria-label="`Move ${dashboard.name} up`" :title="`Move ${dashboard.name} up`" class="min-h-10 px-3 !text-2xl leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-50" @click="moveDashboard(index, -1)"><span aria-hidden="true">↑</span></button>
              <button data-testid="dashboard-move-down" type="button" :disabled="index === dashboards.length - 1 || reorderPending" :aria-label="`Move ${dashboard.name} down`" :title="`Move ${dashboard.name} down`" class="min-h-10 px-3 !text-2xl leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-50" @click="moveDashboard(index, 1)"><span aria-hidden="true">↓</span></button>
              <button data-testid="dashboard-archive-open" type="button" :disabled="!canArchive(dashboard)" :aria-disabled="!canArchive(dashboard)" :aria-label="`Archive ${dashboard.name}`" :title="`Archive ${dashboard.name}`" class="min-h-10 px-3 !text-2xl leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-50" :class="dashboard.isHome ? 'text-red-500 opacity-50' : ''" @click="openArchive(dashboard)"><span aria-hidden="true">⌫</span></button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <div
      v-if="renameTarget"
      data-testid="dashboard-rename-overlay"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 px-3 py-6 backdrop-blur-[1px] md:px-5"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Rename dashboard"
        class="w-full max-w-md border border-[var(--foundation-border)] bg-[var(--foundation-background)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      >
        <h2 class="m-0 text-sm font-semibold">Rename dashboard</h2>
        <form class="mt-3 grid gap-2" @submit.prevent="submitRename">
          <label for="dashboard-rename-name" class="text-sm">Name</label>
          <input
            id="dashboard-rename-name"
            v-model="renameName"
            data-testid="dashboard-rename-name"
            name="name"
            type="text"
            autocomplete="off"
            :disabled="renamePending"
            aria-describedby="dashboard-rename-error"
            class="min-h-9 border border-[var(--foundation-border)] bg-transparent px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
          <p v-if="renameError" id="dashboard-rename-error" data-testid="dashboard-rename-error" role="alert" class="m-0 text-sm text-[var(--foundation-muted)]">{{ renameError }}</p>
          <div class="flex gap-2">
            <button data-testid="dashboard-rename-submit" type="button" :disabled="renamePending" :aria-busy="renamePending" :aria-label="renamePending ? 'Saving dashboard name' : 'Save dashboard name'" :title="renamePending ? 'Saving dashboard name' : 'Save dashboard name'" class="min-h-9 border border-[var(--foundation-border)] px-3 text-lg leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" @click="submitRename"><span aria-hidden="true">{{ renamePending ? '…' : '✓' }}</span></button>
            <button data-testid="dashboard-rename-cancel" type="button" :disabled="renamePending" aria-label="Cancel rename dashboard" title="Cancel rename dashboard" class="min-h-9 px-3 text-lg leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" @click="closeRename"><span aria-hidden="true">×</span></button>
            <button v-if="renameError && renameName.trim()" type="button" :disabled="renamePending" aria-label="Retry rename dashboard" title="Retry rename dashboard" class="min-h-9 px-3 text-lg leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" @click="submitRename"><span aria-hidden="true">↻</span></button>
          </div>
        </form>
      </section>
    </div>

    <div
      v-if="archiveTarget"
      data-testid="dashboard-archive-overlay"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 px-3 py-6 backdrop-blur-[1px] md:px-5"
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-label="Archive dashboard"
        class="w-full max-w-md border border-[var(--foundation-border)] bg-[var(--foundation-background)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      >
        <p data-testid="dashboard-archive-confirmation" class="m-0 text-sm">Archive {{ archiveTarget.name }}?</p>
        <p v-if="archiveError" data-testid="dashboard-archive-error" role="alert" class="mt-2 text-sm text-[var(--foundation-muted)]">{{ archiveError }}</p>
        <div class="mt-3 flex gap-2">
          <button data-testid="dashboard-archive-confirm" type="button" :disabled="archivePending" :aria-busy="archivePending" :aria-label="archivePending ? 'Archiving dashboard' : 'Archive dashboard'" :title="archivePending ? 'Archiving dashboard' : 'Archive dashboard'" class="min-h-9 border border-[var(--foundation-border)] px-3 text-lg leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" @click="submitArchive"><span aria-hidden="true">{{ archivePending ? '…' : '⌫' }}</span></button>
          <button type="button" :disabled="archivePending" aria-label="Cancel archive dashboard" title="Cancel archive dashboard" class="min-h-9 px-3 text-lg leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" @click="closeArchive"><span aria-hidden="true">×</span></button>
          <button v-if="archiveError" type="button" :disabled="archivePending" aria-label="Retry archive dashboard" title="Retry archive dashboard" class="min-h-9 px-3 text-lg leading-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" @click="submitArchive"><span aria-hidden="true">↻</span></button>
        </div>
      </section>
    </div>
  </main>
</template>
