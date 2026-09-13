<script setup lang="ts">
import { onMounted } from 'vue'

import AvatarPicker from '../components/AvatarPicker.vue'
import UiAlert from '../components/ui/alert/Alert.vue'
import UiButton from '../components/ui/button/Button.vue'
import UiInput from '../components/ui/input/Input.vue'
import UiLabel from '../components/ui/label/Label.vue'
import { useOnboarding } from '../composables/useOnboarding'
import { useSession } from '../composables/useSession'

const { session } = useSession()

const {
  avatarKey,
  clearLocation,
  completed,
  detectLocation,
  displayName,
  fieldErrors,
  isLoadingDraft,
  isSubmitting,
  loadDraft,
  locationLabel,
  locationSummary,
  status,
  submit,
  timezone,
} = useOnboarding()

onMounted(async () => {
  await loadDraft()
})
</script>

<template>
  <main class="auth-page onboarding-page" aria-labelledby="onboarding-heading">
    <header class="onboarding-header">
      <p class="eyebrow">SETUP / 01</p>
      <h1 id="onboarding-heading">Onboarding: Configure your setup</h1>
      <p v-if="session">Welcome {{ session.displayName }}.</p>
      <p>Choose a local baseline. Location remains optional.</p>
    </header>

    <form class="onboarding-form" novalidate @submit.prevent="submit">
      <p v-if="isLoadingDraft" class="field-hint" aria-live="polite">Loading saved onboarding details…</p>

      <UiLabel class="onboarding-field" for="display-name">
        <span>Display name</span>
        <UiInput
          id="display-name"
          v-model="displayName"
          data-testid="display-name-input"
          class="terminal-input"
          name="displayName"
          type="text"
          autocomplete="name"
          maxlength="80"
          required
          :aria-invalid="fieldErrors.displayName ? 'true' : undefined"
          aria-describedby="display-name-error"
        />
        <span v-if="fieldErrors.displayName" id="display-name-error" class="field-error" role="alert">{{ fieldErrors.displayName }}</span>
      </UiLabel>

      <AvatarPicker v-model="avatarKey" :error="fieldErrors.avatarKey" />

      <UiLabel class="onboarding-field" for="timezone">
        <span>Timezone</span>
        <UiInput
          id="timezone"
          v-model="timezone"
          data-testid="timezone-input"
          class="terminal-input"
          name="timezone"
          type="text"
          autocomplete="off"
          placeholder="Europe/Madrid"
          required
          :aria-invalid="fieldErrors.timezone ? 'true' : undefined"
          aria-describedby="timezone-help timezone-error"
        />
        <span id="timezone-help" class="field-hint">Detected from this browser only when no saved timezone exists. You can correct it.</span>
        <span v-if="fieldErrors.timezone" id="timezone-error" class="field-error" role="alert">{{ fieldErrors.timezone }}</span>
      </UiLabel>

      <fieldset class="onboarding-field">
        <legend>Location <span class="field-hint">optional</span></legend>
        <p id="location-optional-note" data-testid="location-optional-note" class="field-hint">Optional. Manual labels are non-geocoded and do not look up a city.</p>
        <div class="location-actions">
          <UiButton data-testid="detect-location" class="terminal-button touch-target" type="button" @click="detectLocation">Detect browser location</UiButton>
          <UiButton data-testid="skip-location" class="terminal-button touch-target" type="button" @click="clearLocation">Skip location</UiButton>
          <UiButton data-testid="clear-location" class="terminal-button touch-target" type="button" @click="clearLocation">Clear location</UiButton>
        </div>
        <UiLabel class="manual-location" for="location-label">
          <span>Optional manual label</span>
          <UiInput
            id="location-label"
            v-model="locationLabel"
            data-testid="location-label-input"
            class="terminal-input"
            type="text"
            maxlength="120"
            placeholder="Tokyo"
            aria-describedby="location-label-kind"
          />
        </UiLabel>
        <span id="location-label-kind" data-testid="location-label-kind" class="field-hint">Manual labels are non-geocoded.</span>
        <p data-testid="location-summary" class="field-hint">{{ locationSummary }}</p>
        <p data-testid="location-status" class="field-status" aria-live="polite">{{ status }}</p>
        <p v-if="fieldErrors.defaultLocation" class="field-error" role="alert">{{ fieldErrors.defaultLocation }}</p>
      </fieldset>

      <p data-testid="onboarding-loading" class="field-status" aria-live="polite">{{ isSubmitting ? 'Saving onboarding details…' : status ? 'Saving paused. Retry when ready.' : 'Ready to save.' }}</p>
      <UiAlert v-if="status && !completed" data-testid="onboarding-error" class="field-error" role="alert">{{ status }}</UiAlert>
      <UiAlert v-if="completed" data-testid="onboarding-success" class="field-success" aria-live="polite">{{ status }}</UiAlert>

      <div class="form-actions">
        <UiButton data-testid="onboarding-submit" class="terminal-button primary touch-target" type="submit" :disabled="isSubmitting || completed" :aria-busy="isSubmitting" @click="submit">
          {{ isSubmitting ? 'Saving…' : 'Complete setup' }}
        </UiButton>
        <UiButton v-if="status && !completed" data-testid="onboarding-retry" class="terminal-button touch-target" type="button" :disabled="isSubmitting" @click="submit">Retry save</UiButton>
      </div>
    </form>
  </main>
</template>

<style scoped>
.onboarding-page { max-width: 48rem; margin: 0 auto; padding: 2rem 1rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.onboarding-header, .onboarding-field, .onboarding-form { display: grid; gap: .55rem; }
.onboarding-header { border-bottom: 1px solid currentColor; padding-bottom: 1rem; margin-bottom: 1rem; }
.onboarding-header h1 { font-size: 1.25rem; margin: 0; }
.onboarding-header p { margin: 0; }
.eyebrow { font-size: .75rem; letter-spacing: .08em; }
.onboarding-form { border: 1px solid currentColor; padding: 1rem; }
.onboarding-field { border: 0; margin: 0; min-width: 0; padding: .75rem 0; }
.onboarding-field + .onboarding-field { border-top: 1px solid color-mix(in srgb, currentColor 35%, transparent); }
.terminal-input { background: transparent; border: 1px solid currentColor; border-radius: 0; color: inherit; font: inherit; min-height: 2.75rem; padding: .5rem .65rem; }
.terminal-input:focus-visible, .terminal-button:focus-visible, .avatar-option:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.field-hint, .field-status { font-size: .8125rem; margin: 0; opacity: .8; }
.field-error { color: #d66; font-size: .8125rem; margin: 0; }
.field-success { color: #7abf8a; font-size: .8125rem; margin: 0; }
.location-actions, .form-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
.manual-location { display: grid; gap: .4rem; }
.terminal-button { background: transparent; border: 1px solid currentColor; border-radius: 0; color: inherit; cursor: pointer; font: inherit; padding: .5rem .75rem; }
.terminal-button.primary { background: currentColor; color: Canvas; }
.terminal-button:disabled { cursor: not-allowed; opacity: .55; }
.touch-target { min-height: 2.75rem; }
:deep(.avatar-grid) { display: grid; gap: .5rem; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr)); }
:deep(.avatar-option) { align-items: center; background: transparent; border: 1px solid currentColor; color: inherit; display: grid; font: inherit; gap: .35rem; justify-items: center; padding: .5rem; }
:deep(.avatar-option.is-selected) { background: color-mix(in srgb, currentColor 16%, transparent); outline: 1px solid currentColor; }
:deep(.avatar-option img) { image-rendering: pixelated; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }
</style>
