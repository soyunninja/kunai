<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<template>
  <button
    v-bind="$attrs"
    :class="[
      'inline-flex items-center justify-center border border-current bg-transparent px-3 py-2 font-mono text-sm text-current transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:pointer-events-none disabled:opacity-55',
      $attrs.class,
    ]"
  >
    <slot />
  </button>
</template>
