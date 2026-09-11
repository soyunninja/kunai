import {
  getPocketBaseConfig,
  type PocketBaseRuntimeConfig,
} from '../utils/pocketbase'

export const validatePocketBaseRuntimeConfig = (
  config: PocketBaseRuntimeConfig,
): void => {
  getPocketBaseConfig(config)
}

export default defineNitroPlugin(() => {
  validatePocketBaseRuntimeConfig(useRuntimeConfig())
})
