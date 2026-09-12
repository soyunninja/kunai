<script setup lang="ts">
import { useTheme, type ThemeMode } from './composables/useTheme'
import { useSession } from './composables/useSession'

const { mode } = useTheme()
const { validationMessage, validationState } = useSession()

const themeOptions: ReadonlyArray<{ label: string, value: ThemeMode }> = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
]

const updateTheme = (event: Event) => {
  const nextMode = (event.target as HTMLSelectElement).value as ThemeMode
  mode.value = nextMode
  document.documentElement.dataset.theme = nextMode
}
</script>

<template>
  <div class="app-shell">
    <main v-if="validationState === 'unavailable'" class="auth-page" aria-labelledby="session-unavailable-heading">
      <h1 id="session-unavailable-heading">Session could not be validated</h1>
      <p>{{ validationMessage || 'Session could not be validated' }}</p>
    </main>

    <NuxtPage v-else />

    <label class="foundation-field" for="appearance">
      <span>Appearance</span>
      <select id="appearance" v-model="mode" name="appearance" @change="updateTheme">
        <option v-for="option in themeOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
  </div>
</template>
