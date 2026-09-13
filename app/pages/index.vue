<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { navigateTo } from '#imports'

import UiButton from '../components/ui/button/Button.vue'
import { useSession } from '../composables/useSession'

interface HomeEnvelope {
  readonly dashboard: {
    readonly id: string
    readonly name: string
  }
  readonly initialized: boolean
}

const { logout, session } = useSession()
const homeName = ref('Home')
const initialized = ref(true)
const homeStatus = ref('Private Home initialized.')
const logoutPending = ref(false)

const isHomeEnvelope = (value: unknown): value is HomeEnvelope => (
  typeof value === 'object'
  && value !== null
  && 'dashboard' in value
  && typeof value.dashboard === 'object'
  && value.dashboard !== null
  && 'name' in value.dashboard
  && typeof value.dashboard.name === 'string'
  && 'initialized' in value
  && typeof value.initialized === 'boolean'
)

onMounted(async () => {
  try {
    const response = await $fetch<unknown>('/api/home')
    if (isHomeEnvelope(response)) {
      homeName.value = response.dashboard.name
      initialized.value = response.initialized
      homeStatus.value = response.initialized ? 'Private Home initialized.' : 'Private Home unavailable.'
    }
  } catch {
    homeStatus.value = 'Private Home could not be confirmed. Please retry.'
    initialized.value = false
  }
})

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
  <main class="home-page" aria-labelledby="home-heading">
    <header class="home-header">
      <p class="eyebrow">HOME / READY</p>
      <h1 id="home-heading" data-testid="home-name">{{ homeName }}</h1>
      <p v-if="session" data-testid="authenticated-user">Authenticated user: {{ session.displayName }} · {{ session.id }}</p>
    </header>

    <section class="home-panel" aria-live="polite">
      <p data-testid="home-initialized">{{ initialized ? 'Initialized' : 'Unavailable' }}</p>
      <p>{{ homeStatus }}</p>
    </section>

    <div class="home-actions">
      <UiButton data-testid="logout" class="home-button touch-target" type="button" :disabled="logoutPending" @click="handleLogout">
        {{ logoutPending ? 'Logging out…' : 'Log out' }}
      </UiButton>
    </div>
  </main>
</template>

<style scoped>
.home-page {
  display: flex;
  width: min(100%, 46rem);
  flex-direction: column;
  gap: 1rem;
  border: 1px solid var(--foundation-border);
  background: var(--foundation-surface);
  padding: clamp(1rem, 3vw, 2rem);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.home-header,
.home-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.home-header {
  border-bottom: 1px solid var(--foundation-border);
  padding-bottom: 1rem;
}

.home-header h1,
.home-header p,
.home-panel p {
  margin: 0;
}

.eyebrow {
  color: var(--foundation-muted);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
}

.home-panel {
  border: 1px solid color-mix(in srgb, var(--foundation-border) 80%, transparent);
  padding: 1rem;
}

.home-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.home-button {
  min-height: 2.75rem;
}

.touch-target {
  min-height: 2.75rem;
}
</style>
