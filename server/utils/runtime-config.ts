import type { H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'

export const getRuntimeConfig = (event: H3Event) => useRuntimeConfig(event)
