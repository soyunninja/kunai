import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'

import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase'
import { expect } from 'vitest'

export const POCKETBASE_VERSION = '0.40.3'
export const POCKETBASE_DOWNLOAD_URL = `https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_amd64.zip`
export const POCKETBASE_ARCHIVE_SHA256 = '8d81b6b79add0e219373e922ebe1dddbee7f57fcff602e3585e0d2c654b983ce'
export const SUPERUSER_EMAIL = 'phase-0002-admin@example.test'
export const SUPERUSER_PASSWORD = 'phase-0002-admin-password-123'
export const USER_PASSWORD = 'phase-0002-user-password-123'

export interface PocketBaseHarness {
  root: string
  binary: string
  dataDir: string
  migrationsDir: string
  hooksDir: string
  port: number
  baseUrl: string
  server?: ChildProcessWithoutNullStreams
}

export interface NormalUser {
  id: string
  email: string
  token: string
}

export interface AuthenticatedClient {
  pb: PocketBase
  user: NormalUser
}

export const runPocketBaseCommand = (
  command: string,
  args: string[],
  options: { cwd?: string, timeout?: number, input?: string, env?: NodeJS.ProcessEnv } = {},
) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    input: options.input,
    timeout: options.timeout ?? 60_000,
  })

  if (result.status !== 0) {
    throw new Error([
      `Command failed: ${command} ${args.join(' ')}`,
      `status=${result.status}`,
      result.stdout,
      result.stderr,
    ].join('\n'))
  }

  return result
}

const wait = (ms: number) => new Promise((resolveWait) => setTimeout(resolveWait, ms))

const waitForHealth = async (baseUrl: string) => {
  const deadline = Date.now() + 15_000
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) {
        return
      }
      lastError = new Error(`health status ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await wait(150)
  }

  throw lastError instanceof Error ? lastError : new Error('PocketBase health check timed out')
}

export const downloadPocketBase = async (root: string) => {
  const archivePath = join(root, 'pocketbase.zip')
  const binaryPath = join(root, 'pocketbase')

  const response = await fetch(POCKETBASE_DOWNLOAD_URL)
  if (!response.ok) {
    throw new Error(`Failed to download PocketBase ${POCKETBASE_VERSION}: ${response.status}`)
  }

  const archive = Buffer.from(await response.arrayBuffer())
  const digest = createHash('sha256').update(archive).digest('hex')
  expect(digest).toBe(POCKETBASE_ARCHIVE_SHA256)
  await writeFile(archivePath, archive)
  runPocketBaseCommand('unzip', ['-q', archivePath, 'pocketbase'], { cwd: root })
  runPocketBaseCommand('chmod', ['+x', binaryPath])

  return binaryPath
}

export const createPocketBaseHarness = async (): Promise<PocketBaseHarness> => {
  const root = await mkdtemp(join(tmpdir(), 'kunai-pb-phase-0002-'))
  const dataDir = join(root, 'data')
  await mkdir(dataDir)

  const binary = await downloadPocketBase(root)
  const port = 18_000 + Math.floor(Math.random() * 20_000)
  const baseUrl = `http://127.0.0.1:${port}`

  return {
    root,
    binary,
    dataDir,
    migrationsDir: resolve('pb_migrations'),
    hooksDir: resolve('pb_hooks'),
    port,
    baseUrl,
  }
}

export const startPocketBase = async (harness: PocketBaseHarness) => {
  harness.server = spawn(harness.binary, [
    'serve',
    `--http=127.0.0.1:${harness.port}`,
    `--dir=${harness.dataDir}`,
    `--migrationsDir=${harness.migrationsDir}`,
    `--hooksDir=${harness.hooksDir}`,
    '--dev=false',
  ], { stdio: 'pipe' })

  await waitForHealth(harness.baseUrl)
}

export const stopPocketBase = async (harness: PocketBaseHarness) => {
  if (harness.server && !harness.server.killed) {
    harness.server.kill('SIGTERM')
    await wait(300)
    if (!harness.server.killed) {
      harness.server.kill('SIGKILL')
    }
  }

  if (existsSync(harness.root)) {
    await rm(harness.root, { recursive: true, force: true })
  }
}

export const applyMigrations = (harness: PocketBaseHarness) => {
  runPocketBaseCommand(harness.binary, ['migrate', 'up', `--dir=${harness.dataDir}`, `--migrationsDir=${harness.migrationsDir}`])
}

export const reverseMigrations = (harness: PocketBaseHarness) => {
  runPocketBaseCommand(
    harness.binary,
    ['migrate', 'down', `--dir=${harness.dataDir}`, `--migrationsDir=${harness.migrationsDir}`],
    { env: { KUNAI_ALLOW_DESTRUCTIVE_MIGRATION_DOWN: '1' } },
  )
}

export const upsertSuperuser = (harness: PocketBaseHarness) => {
  runPocketBaseCommand(harness.binary, [
    'superuser',
    'upsert',
    SUPERUSER_EMAIL,
    SUPERUSER_PASSWORD,
    `--dir=${harness.dataDir}`,
  ])
}

export const superuserClient = async (baseUrl: string) => {
  const pb = new PocketBase(baseUrl, new BaseAuthStore())
  pb.autoCancellation(false)
  await pb.collection('_superusers').authWithPassword(SUPERUSER_EMAIL, SUPERUSER_PASSWORD)
  return pb
}

export const createNormalUser = async (admin: PocketBase, email: string) => {
  const record = await admin.collection('users').create({
    email,
    password: USER_PASSWORD,
    passwordConfirm: USER_PASSWORD,
  })

  return record.id as string
}

export const normalClient = async (baseUrl: string, email: string): Promise<AuthenticatedClient> => {
  const pb = new PocketBase(baseUrl, new BaseAuthStore())
  pb.autoCancellation(false)
  const auth = await pb.collection('users').authWithPassword(email, USER_PASSWORD)

  return {
    pb,
    user: {
      id: auth.record.id,
      email,
      token: auth.token,
    },
  }
}

export const expectClientError = async (operation: Promise<unknown>, statuses: number[]) => {
  try {
    await operation
    throw new Error('Expected PocketBase request to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(ClientResponseError)
    const clientError = error as ClientResponseError
    expect(statuses).toContain(clientError.status)
    return clientError
  }
}
