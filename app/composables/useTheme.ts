import { ref, watch } from 'vue'

export type ThemeMode = 'dark' | 'light' | 'system'

export const useTheme = () => {
  const mode = ref<ThemeMode>('dark')

  useHead({
    htmlAttrs: { 'data-theme': mode },
  })

  if (import.meta.client) {
    watch(
      mode,
      (value) => {
        document.documentElement.dataset.theme = value
      },
      { immediate: true },
    )
  }

  return { mode }
}
