<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div
    v-bind="$attrs"
    :class="[
      'border border-current px-3 py-2 font-mono text-sm',
      $attrs.class,
    ]"
  >
    <slot />
  </div>
</template>
