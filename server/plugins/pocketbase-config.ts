import {
  getPocketBaseConfig,
  type PocketBaseRuntimeConfig,
} from '../utils/pocketbase'
import { getSessionConfig, type SessionRuntimeConfig } from '../utils/session-config'

export const validatePocketBaseRuntimeConfig = (
  config: PocketBaseRuntimeConfig & SessionRuntimeConfig,
): void => {
  getPocketBaseConfig(config)
  getSessionConfig(config)
}

export default defineNitroPlugin(() => {
  validatePocketBaseRuntimeConfig(useRuntimeConfig())
})
