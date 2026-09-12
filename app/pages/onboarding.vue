<script setup lang="ts">
import { computed } from 'vue'

import { useSession } from '../composables/useSession'

const { session } = useSession()
const safeSessionJson = computed(() => JSON.stringify(session.value))
</script>

<template>
  <main class="auth-page" aria-labelledby="onboarding-heading">
    <h1 id="onboarding-heading">Onboarding</h1>
    <p v-if="session">Welcome {{ session.displayName }}.</p>
    <pre data-safe-session>{{ safeSessionJson }}</pre>
  </main>
</template>
