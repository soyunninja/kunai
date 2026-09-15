<script setup lang="ts">
import { useSession } from './composables/useSession'

const { validationMessage, validationState } = useSession()
</script>

<template>
  <div class="app-shell">
    <main v-if="validationState === 'unavailable'" class="auth-page" aria-labelledby="session-unavailable-heading">
      <h1 id="session-unavailable-heading">Session could not be validated</h1>
      <p>{{ validationMessage || 'Session could not be validated' }}</p>
    </main>

    <NuxtPage v-else />

  </div>
</template>
