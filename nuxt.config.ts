import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  ssr: true,
  srcDir: 'app/',
  css: ['~/assets/css/main.css'],
  modules: ['@nuxt/eslint'],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    pocketbaseUrl: '',
  },
  typescript: {
    strict: true,
  },
})
