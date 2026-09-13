import { access, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const sourcePath = 'project/avatar-registry.json'
const sourceAbsolutePath = resolve(root, sourcePath)

const avatarKeyPattern = /^[a-z0-9][a-z0-9-]{0,79}$/

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
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

const source = JSON.parse(await readFile(sourceAbsolutePath, 'utf8'))
const errors = []
const keys = new Set()

if (!Array.isArray(source)) {
  throw new Error(`${sourcePath} must be an array`)
}

for (const [index, entry] of source.entries()) {
  if (!isPlainObject(entry)) {
    errors.push(`avatar[${index}] must be an object`)
    continue
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
  } else {
    try {
      await access(resolve(root, 'public', entry.src.replace(/^\//, '')))
    } catch {
      errors.push(`avatar[${index}].src file does not exist`)
    }
  }

  if (!isPlainString(entry.label) || entry.label.length > 80) {
    errors.push(`avatar[${index}].label is invalid`)
  }
}

if (errors.length > 0) {
  throw new Error(errors.join('\n'))
}

const registry = source.map(({ key, src, label }) => ({ key, src, label }))
const header = [
  'Generated file.',
  'Generator: scripts/generate-avatars.mjs',
  `Source: ${sourcePath} (owner-approved production avatar registry).`,
  'Do not edit manually.',
]
const generatedNotice = header.map((line) => `// ${line}`).join('\n')
const json = JSON.stringify(registry, null, 2)

await writeFile(resolve(root, 'shared/generated/avatars.ts'), `${generatedNotice}\n\nexport const GENERATED_AVATAR_REGISTRY = ${json} as const\n`)

await writeFile(resolve(root, 'pb_hooks/lib/avatar-manifest.js'), `${generatedNotice}\n\nconst AVATAR_MANIFEST = ${json}\n\nconst avatarKeyPattern = /^[a-z0-9][a-z0-9-]{0,79}$/\n\nconst isPlainString = (value) => typeof value === 'string' && value.trim() === value && value.length > 0\n\nconst isSafeAvatarSrc = (src) => (\n  src.startsWith('/avatars/')\n  && !src.includes('..')\n  && !src.includes('\\\\')\n  && !src.includes('//')\n  && !src.includes('?')\n  && !src.includes('#')\n  && src.length > '/avatars/'.length\n)\n\nconst validateAvatarManifest = (manifest) => {\n  const errors = []\n  const keys = new Set()\n\n  if (!Array.isArray(manifest)) {\n    return {\n      ok: false,\n      errors: ['avatar manifest must be an array'],\n    }\n  }\n\n  manifest.forEach((entry, index) => {\n    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {\n      errors.push(\`avatar[\${index}] must be an object\`)\n      return\n    }\n\n    if (!isPlainString(entry.key) || !avatarKeyPattern.test(entry.key)) {\n      errors.push(\`avatar[\${index}].key is invalid\`)\n    } else if (keys.has(entry.key)) {\n      errors.push(\`avatar[\${index}].key is duplicated\`)\n    } else {\n      keys.add(entry.key)\n    }\n\n    if (!isPlainString(entry.src) || !isSafeAvatarSrc(entry.src)) {\n      errors.push(\`avatar[\${index}].src is unsafe\`)\n    }\n\n    if (!isPlainString(entry.label) || entry.label.length > 80) {\n      errors.push(\`avatar[\${index}].label is invalid\`)\n    }\n  })\n\n  return {\n    ok: errors.length === 0,\n    errors,\n  }\n}\n\nconst avatarKeyAllowlist = (manifest) => {\n  const result = validateAvatarManifest(manifest)\n  if (!result.ok) {\n    return []\n  }\n\n  return manifest.map((entry) => entry.key)\n}\n\nif (typeof module !== 'undefined') {\n  module.exports = {\n    AVATAR_MANIFEST,\n    avatarKeyAllowlist,\n    isSafeAvatarSrc,\n    validateAvatarManifest,\n  }\n}\n`)

console.log(`Generated ${registry.length} avatar registry entries from ${sourcePath}`)
