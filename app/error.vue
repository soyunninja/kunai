<script setup lang="ts">
defineProps<{
  readonly error: {
    readonly statusCode?: number
    readonly statusMessage?: string
    readonly message?: string
  }
}>()
</script>

<template>
  <main class="auth-page" aria-labelledby="session-unavailable-heading">
    <h1 id="session-unavailable-heading">
      {{ error.statusCode === 503 ? 'Session could not be validated' : 'Application error' }}
    </h1>
    <p>{{ error.statusMessage || error.message || 'Please retry.' }}</p>
  </main>
</template>
