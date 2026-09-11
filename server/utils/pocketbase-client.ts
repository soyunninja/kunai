import PocketBase, { BaseAuthStore } from 'pocketbase'

import { getPocketBaseConfig, type PocketBaseRuntimeConfig } from './pocketbase'

export type RequestAuthIntent = 'anonymous' | 'authenticated'

export interface RequestContext extends Record<string, unknown> {
  pocketBaseClient?: PocketBase
  pocketBaseAuthIntent?: RequestAuthIntent
  pocketBaseAuthToken?: string
}

export interface RequestEventLike {
  readonly context: RequestContext
}

export const createRequestPocketBase = (
  runtimeConfig: PocketBaseRuntimeConfig,
  token?: string,
): PocketBase => {
  const { endpoint } = getPocketBaseConfig(runtimeConfig)
  const authStore = new BaseAuthStore()
  if (token) {
    authStore.save(token, null)
  }

  const pb = new PocketBase(endpoint, authStore)
  pb.autoCancellation(false)
  return pb
}

export const getRequestPocketBase = (
  event: RequestEventLike,
  runtimeConfig: PocketBaseRuntimeConfig,
  token?: string,
): PocketBase => {
  const { context } = event
  const requestedIntent: RequestAuthIntent = token ? 'authenticated' : 'anonymous'
  if (context.pocketBaseClient) {
    if (context.pocketBaseAuthIntent !== requestedIntent) {
      throw new Error('Request PocketBase client already exists with a different auth intent.')
    }

    if (requestedIntent === 'authenticated' && context.pocketBaseAuthToken !== token) {
      throw new Error('Request PocketBase client already exists with a different auth token.')
    }

    return context.pocketBaseClient
  }

  context.pocketBaseAuthIntent = requestedIntent
  context.pocketBaseAuthToken = token
  context.pocketBaseClient = createRequestPocketBase(runtimeConfig, token)
  return context.pocketBaseClient
}
