import { GENERATED_AVATAR_REGISTRY } from './generated/avatars'

export interface AvatarRegistryEntry {
  readonly key: string
  readonly src: string
  readonly label: string
}

export type AvatarRegistry = readonly AvatarRegistryEntry[]

export interface AvatarRegistryValidationResult {
  readonly ok: boolean
  readonly errors: readonly string[]
}

export const AVATAR_REGISTRY = GENERATED_AVATAR_REGISTRY satisfies AvatarRegistry

const avatarKeyPattern = /^[a-z0-9][a-z0-9-]{0,79}$/

const isPlainString = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && value.length > 0

export const avatarKeyAllowlist = (registry: AvatarRegistry = AVATAR_REGISTRY): readonly string[] => (
  validateAvatarRegistry(registry).ok ? registry.map((entry) => entry.key) : []
)

export const isApprovedAvatarKey = (key: string, registry: AvatarRegistry = AVATAR_REGISTRY): boolean => (
  avatarKeyAllowlist(registry).includes(key)
)

export const isSafeAvatarSrc = (src: string): boolean => (
  src.startsWith('/avatars/')
  && !src.includes('..')
  && !src.includes('\\')
  && !src.includes('//')
  && !src.includes('?')
  && !src.includes('#')
  && src.length > '/avatars/'.length
)

export const validateAvatarRegistry = (registry: AvatarRegistry): AvatarRegistryValidationResult => {
  const errors: string[] = []
  const keys = new Set<string>()

  registry.forEach((entry, index) => {
    if (!isPlainString(entry.key) || !avatarKeyPattern.test(entry.key)) {
      errors.push(`avatar[${index}].key is invalid`)
    } else if (keys.has(entry.key)) {
      errors.push(`avatar[${index}].key is duplicated`)
    } else {
      keys.add(entry.key)
    }

    if (!isPlainString(entry.src) || !isSafeAvatarSrc(entry.src)) {
      errors.push(`avatar[${index}].src is unsafe`)
    }

    if (!isPlainString(entry.label) || entry.label.length > 80) {
      errors.push(`avatar[${index}].label is invalid`)
    }
  })

  return {
    ok: errors.length === 0,
    errors,
  }
}
