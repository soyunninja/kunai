<script setup lang="ts">
import { computed, ref } from 'vue'

import UiAlert from '../components/ui/alert/Alert.vue'
import UiButton from '../components/ui/button/Button.vue'
import UiInput from '../components/ui/input/Input.vue'
import UiLabel from '../components/ui/label/Label.vue'
import { useSession } from '../composables/useSession'
import { useTheme } from '../composables/useTheme'

const email = ref('')
const password = ref('')
const formError = ref('')
const isSubmitting = ref(false)

const { login, validationMessage } = useSession()
const { mode } = useTheme()

const displayError = computed(() => formError.value || validationMessage.value)

const submitLogin = async () => {
  if (isSubmitting.value) return

  formError.value = ''
  isSubmitting.value = true

  try {
    const envelope = await login({
      email: email.value,
      password: password.value,
    })

    if (envelope.session?.onboardingCompleted) {
      void navigateTo('/')
      return
    }

    if (envelope.session) {
      void navigateTo('/onboarding')
      return
    }

    formError.value = 'Invalid email or password'
  } catch {
    formError.value = validationMessage.value || 'Login is temporarily unavailable'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="auth-page login-page" aria-labelledby="login-heading" data-design-tone="terminal dark-first compact">
    <section class="login-panel" aria-describedby="login-description">
      <header class="login-header">
        <p class="eyebrow">AUTH / 01</p>
        <h1 id="login-heading">Login</h1>
        <p id="login-description">Sign in to continue to your private dashboard shell.</p>
        <p class="theme-status" aria-live="polite">Appearance: {{ mode }}</p>
      </header>

      <form class="login-form" novalidate @submit.prevent="submitLogin">
        <UiLabel for="login-email">
          <span>Email</span>
          <UiInput
            id="login-email"
            v-model="email"
            data-testid="login-email"
            name="email"
            type="email"
            autocomplete="email"
            inputmode="email"
            required
            :disabled="isSubmitting"
            :aria-invalid="displayError ? 'true' : undefined"
            aria-describedby="login-error"
          />
        </UiLabel>

        <UiLabel for="login-password">
          <span>Password</span>
          <UiInput
            id="login-password"
            v-model="password"
            data-testid="login-password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            :disabled="isSubmitting"
            :aria-invalid="displayError ? 'true' : undefined"
            aria-describedby="login-error"
          />
        </UiLabel>

        <UiAlert
          v-if="displayError"
          id="login-error"
          data-testid="login-error"
          class="login-error"
          role="alert"
        >
          {{ displayError }}
        </UiAlert>

        <p class="login-status" aria-live="polite">
          {{ isSubmitting ? 'Authenticating…' : 'Ready.' }}
        </p>

        <UiButton
          data-testid="login-submit"
          class="login-submit"
          type="submit"
          :disabled="isSubmitting"
          :aria-busy="isSubmitting"
        >
          {{ isSubmitting ? 'Signing in…' : 'Sign in' }}
        </UiButton>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  align-items: center;
  display: grid;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  min-height: 100svh;
  padding: 1rem;
}

.login-panel {
  border: 1px solid currentColor;
  display: grid;
  gap: 1.25rem;
  margin: 0 auto;
  max-width: 28rem;
  padding: 1rem;
  width: 100%;
}

.login-header,
.login-form {
  display: grid;
  gap: .75rem;
}

.login-header {
  border-bottom: 1px solid color-mix(in srgb, currentColor 35%, transparent);
  padding-bottom: 1rem;
}

.login-header h1,
.login-header p {
  margin: 0;
}

.login-header h1 {
  font-size: clamp(1.4rem, 6vw, 2.25rem);
  letter-spacing: -.04em;
}

.eyebrow,
.theme-status,
.login-status {
  font-size: .8125rem;
  opacity: .8;
}

.login-submit {
  min-height: 2.75rem;
}

.login-submit:not(:disabled) {
  background: currentColor;
  color: Canvas;
}

.login-error {
  color: #d66;
}
</style>
