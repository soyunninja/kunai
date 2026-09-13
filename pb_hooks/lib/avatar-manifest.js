// Generated file.
// Generator: scripts/generate-avatars.mjs
// Source: project/avatar-registry.json (owner-approved production avatar registry).
// Do not edit manually.

const AVATAR_MANIFEST = [
  {
    "key": "avatar-01",
    "src": "/avatars/avatar-01.png",
    "label": "Avatar 01"
  },
  {
    "key": "avatar-02",
    "src": "/avatars/avatar-02.png",
    "label": "Avatar 02"
  },
  {
    "key": "avatar-03",
    "src": "/avatars/avatar-03.png",
    "label": "Avatar 03"
  },
  {
    "key": "avatar-04",
    "src": "/avatars/avatar-04.png",
    "label": "Avatar 04"
  },
  {
    "key": "avatar-05",
    "src": "/avatars/avatar-05.png",
    "label": "Avatar 05"
  },
  {
    "key": "avatar-06",
    "src": "/avatars/avatar-06.png",
    "label": "Avatar 06"
  },
  {
    "key": "avatar-07",
    "src": "/avatars/avatar-07.png",
    "label": "Avatar 07"
  },
  {
    "key": "avatar-08",
    "src": "/avatars/avatar-08.png",
    "label": "Avatar 08"
  },
  {
    "key": "avatar-09",
    "src": "/avatars/avatar-09.png",
    "label": "Avatar 09"
  },
  {
    "key": "avatar-10",
    "src": "/avatars/avatar-10.png",
    "label": "Avatar 10"
  }
]

const avatarKeyPattern = /^[a-z0-9][a-z0-9-]{0,79}$/

const isPlainString = (value) => typeof value === 'string' && value.trim() === value && value.length > 0

const isSafeAvatarSrc = (src) => (
  src.startsWith('/avatars/')
  && !src.includes('..')
  && !src.includes('\\')
  && !src.includes('//')
  && !src.includes('?')
  && !src.includes('#')
  && src.length > '/avatars/'.length
)

const validateAvatarManifest = (manifest) => {
  const errors = []
  const keys = new Set()

  if (!Array.isArray(manifest)) {
    return {
      ok: false,
      errors: ['avatar manifest must be an array'],
    }
  }

  manifest.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`avatar[${index}] must be an object`)
      return
    }

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

const avatarKeyAllowlist = (manifest) => {
  const result = validateAvatarManifest(manifest)
  if (!result.ok) {
    return []
  }

  return manifest.map((entry) => entry.key)
}

if (typeof module !== 'undefined') {
  module.exports = {
    AVATAR_MANIFEST,
    avatarKeyAllowlist,
    isSafeAvatarSrc,
    validateAvatarManifest,
  }
}
