<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<template>
  <label
    v-bind="$attrs"
    :class="[
      'grid gap-2 font-mono text-sm leading-none',
      $attrs.class,
    ]"
  >
    <slot />
  </label>
</template>
