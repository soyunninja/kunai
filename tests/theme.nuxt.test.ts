import { nextTick } from 'vue'
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

  it('renders dark by default and updates the document attribute from the selector', async () => {
    const wrapper = await mountSuspended(App)
    const selector = wrapper.get('select')

    expect(document.documentElement.dataset.theme).toBe('dark')

    await selector.setValue('light')
    await nextTick()
    expect(selector.element.value).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')

    await selector.setValue('system')
    await nextTick()
    expect(selector.element.value).toBe('system')
    expect(document.documentElement.dataset.theme).toBe('system')

    await selector.setValue('dark')
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('dark')

    expect(selector.element).toBeInstanceOf(HTMLSelectElement)
    expect(wrapper.get('label').attributes('for')).toBe('appearance')

    wrapper.unmount()
  })

  it('resets a fresh shell mount to dark after another mount selected light', async () => {
    const firstWrapper = await mountSuspended(App)
    await firstWrapper.get('select').setValue('light')
    firstWrapper.unmount()

    const secondWrapper = await mountSuspended(App)
    await nextTick()

    expect(document.documentElement.dataset.theme).toBe('dark')

    secondWrapper.unmount()
  })
})
