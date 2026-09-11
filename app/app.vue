<script setup lang="ts">
import { useTheme, type ThemeMode } from './composables/useTheme'

const { mode } = useTheme()

const themeOptions: ReadonlyArray<{ label: string; value: ThemeMode }> = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
]
</script>

<template>
  <main class="foundation-shell">
    <section class="foundation-panel" aria-labelledby="foundation-heading">
      <p class="foundation-eyebrow">Foundation</p>
      <h1 id="foundation-heading">Application foundation</h1>
      <p>
        The application baseline is ready for the next implementation phase.
      </p>

      <label class="foundation-field" for="appearance">
        <span>Appearance</span>
        <select id="appearance" v-model="mode" name="appearance">
          <option v-for="option in themeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </section>
  </main>
</template>
