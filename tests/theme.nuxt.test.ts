import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import App from '../app/app.vue'
import { useTheme } from '../app/composables/useTheme'

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('foundation theme', () => {
  it('starts each composable instance in dark mode', () => {
    const { mode } = useTheme()

    expect(mode.value).toBe('dark')
  })

  it('does not render an appearance selector in global app chrome', async () => {
    const wrapper = await mountSuspended(App)

    expect(wrapper.find('#appearance').exists()).toBe(false)

    wrapper.unmount()
  })
})
