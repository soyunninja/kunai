import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { timeZonesNames } from '@vvo/tzdb'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const tzdbVersion = packageJson.devDependencies?.['@vvo/tzdb']

if (typeof tzdbVersion !== 'string' || tzdbVersion.startsWith('^') || tzdbVersion.startsWith('~')) {
  throw new Error('@vvo/tzdb must be pinned to an exact devDependency version')
}

const timezones = [...new Set(timeZonesNames
  .filter((timezone) => typeof timezone === 'string')
  .map((timezone) => timezone.trim())
  .filter(Boolean))]
  .sort((left, right) => left.localeCompare(right, 'en-US'))

const header = [
  'Generated file.',
  'Generator: scripts/generate-timezones.mjs',
  `Source: @vvo/tzdb ${tzdbVersion} (IANA-derived timezone identifiers).`,
  'Do not edit manually.',
]

const generatedNotice = header.map((line) => `// ${line}`).join('\n')
const json = JSON.stringify(timezones, null, 2)

await writeFile(resolve(root, 'shared/generated/timezones.ts'), `${generatedNotice}\n\nexport const IANA_TIMEZONES = ${json} as const\n\nexport type IanaTimezone = typeof IANA_TIMEZONES[number]\n`)

await writeFile(resolve(root, 'pb_hooks/lib/timezone-manifest.js'), `${generatedNotice}\n\nconst IANA_TIMEZONES = ${json}\n\nif (typeof module !== 'undefined') {\n  module.exports = { IANA_TIMEZONES }\n}\n`)

console.log(`Generated ${timezones.length} timezone identifiers from @vvo/tzdb ${tzdbVersion}`)
