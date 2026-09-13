<script setup lang="ts">
import { computed } from 'vue'

import { AVATAR_REGISTRY } from '~~/shared/avatars'

const props = defineProps<{
  readonly modelValue: string
  readonly error?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [key: string]
}>()

const selectedAvatar = computed(() => AVATAR_REGISTRY.find((avatar) => avatar.key === props.modelValue))

const selectAvatar = (key: string) => {
  emit('update:modelValue', key)
}

const selectWithKeyboard = (event: KeyboardEvent, key: string) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    selectAvatar(key)
  }
}
</script>

<template>
  <fieldset class="onboarding-field" :aria-invalid="error ? 'true' : undefined">
    <legend>Avatar</legend>
    <p id="avatar-help" class="field-hint">Choose one bundled profile marker.</p>
    <div class="avatar-grid" role="radiogroup" aria-describedby="avatar-help avatar-error">
      <button
        v-for="avatar in AVATAR_REGISTRY"
        :key="avatar.key"
        :data-testid="`avatar-option-${avatar.key}`"
        class="avatar-option touch-target"
        :class="{ 'is-selected': avatar.key === modelValue }"
        type="button"
        role="radio"
        :aria-checked="avatar.key === modelValue"
        :aria-label="avatar.label"
        :tabindex="avatar.key === modelValue || !selectedAvatar ? 0 : -1"
        @click="selectAvatar(avatar.key)"
        @keydown="selectWithKeyboard($event, avatar.key)"
      >
        <img :src="avatar.src" alt="" width="48" height="48">
        <span>{{ avatar.label }}</span>
      </button>
    </div>
    <p v-if="error" id="avatar-error" data-testid="avatar-error" class="field-error" role="alert">{{ error }}</p>
  </fieldset>
</template>
