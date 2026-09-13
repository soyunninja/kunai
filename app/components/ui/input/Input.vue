<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  readonly modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const updateValue = (event: Event) => {
  emit('update:modelValue', event.target instanceof HTMLInputElement ? event.target.value : '')
}
</script>

<template>
  <input
    v-bind="$attrs"
    :value="modelValue"
    :class="[
      'border border-current bg-transparent px-2.5 py-2 font-mono text-sm text-current placeholder:text-current/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-55',
      $attrs.class,
    ]"
    @input="updateValue"
  >
</template>
