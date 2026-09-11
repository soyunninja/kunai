Object.defineProperties(globalThis, {
  defineNitroPlugin: {
    configurable: true,
    value: <Plugin>(plugin: Plugin): Plugin => plugin,
  },
  useRuntimeConfig: {
    configurable: true,
    value: (): { pocketbaseUrl: string } => ({ pocketbaseUrl: '' }),
  },
})
