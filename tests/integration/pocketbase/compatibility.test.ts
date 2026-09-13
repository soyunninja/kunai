import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'

import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const POCKETBASE_VERSION = '0.40.3'
const POCKETBASE_DOWNLOAD_URL = `https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_amd64.zip`
const POCKETBASE_ARCHIVE_SHA256 = '8d81b6b79add0e219373e922ebe1dddbee7f57fcff602e3585e0d2c654b983ce'
const SUPERUSER_EMAIL = 'compat-admin@example.test'
const SUPERUSER_PASSWORD = 'compat-admin-password-123'
const USER_PASSWORD = 'compat-user-password-123'

interface Harness {
  root: string
  binary: string
  dataDir: string
  migrationsDir: string
  hooksDir: string
  port: number
  baseUrl: string
  server?: ChildProcessWithoutNullStreams
}

interface NormalUser {
  id: string
  email: string
  token: string
}

const harnesses: Harness[] = []

const run = (
  command: string,
  args: string[],
  options: { cwd?: string, timeout?: number } = {},
) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

const downloadPocketBase = async (root: string) => {
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
  run('unzip', ['-q', archivePath, 'pocketbase'], { cwd: root })
  run('chmod', ['+x', binaryPath])

  return binaryPath
}

const createMigration = async (migrationsDir: string) => {
  await writeFile(join(migrationsDir, '001_compatibility.js'), `
/// <reference path="../data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.fields.add(
    new TextField({ name: 'displayName', max: 80 }),
    new BoolField({ name: 'onboardingCompleted' }),
  )
  app.save(users)

  const dashboards = new Collection({ type: 'base', name: 'compat_dashboards' })
  dashboards.fields.add(
    new RelationField({ name: 'owner', collectionId: users.id, required: true, maxSelect: 1 }),
    new TextField({ name: 'name', required: true, max: 80 }),
    new TextField({ name: 'seedKey', max: 80 }),
  )
  dashboards.indexes = [
    'CREATE UNIQUE INDEX idx_compat_dashboards_owner_seed ON compat_dashboards (owner, seedKey) WHERE seedKey != ""',
    'CREATE INDEX idx_compat_dashboards_owner ON compat_dashboards (owner)',
  ]
  dashboards.listRule = 'owner = @request.auth.id'
  dashboards.viewRule = 'owner = @request.auth.id'
  dashboards.createRule = 'owner = @request.auth.id'
  dashboards.updateRule = 'owner = @request.auth.id && @request.body.owner:isset = false'
  dashboards.deleteRule = 'owner = @request.auth.id'
  app.save(dashboards)

  const widgets = new Collection({ type: 'base', name: 'compat_widgets' })
  widgets.fields.add(
    new RelationField({ name: 'owner', collectionId: users.id, required: true, maxSelect: 1 }),
    new RelationField({ name: 'dashboard', collectionId: dashboards.id, required: true, maxSelect: 1 }),
    new TextField({ name: 'type', required: true, max: 80 }),
    new TextField({ name: 'seedKey', max: 80 }),
    new JSONField({ name: 'config', required: true, maxSize: 4096 }),
  )
  widgets.indexes = [
    'CREATE UNIQUE INDEX idx_compat_widgets_dashboard_seed ON compat_widgets (dashboard, seedKey) WHERE seedKey != ""',
    'CREATE INDEX idx_compat_widgets_owner_dashboard ON compat_widgets (owner, dashboard)',
  ]
  widgets.listRule = 'owner = @request.auth.id'
  widgets.viewRule = 'owner = @request.auth.id'
  widgets.createRule = 'owner = @request.auth.id && dashboard.owner = @request.auth.id'
  widgets.updateRule = 'owner = @request.auth.id && @request.body.owner:isset = false && dashboard.owner = @request.auth.id'
  widgets.deleteRule = 'owner = @request.auth.id'
  app.save(widgets)

  const preferences = new Collection({ type: 'base', name: 'compat_preferences' })
  preferences.fields.add(
    new RelationField({ name: 'owner', collectionId: users.id, required: true, maxSelect: 1 }),
    new TextField({ name: 'label', max: 120 }),
    new JSONField({ name: 'defaultLocation', maxSize: 2048 }),
  )
  preferences.indexes = [
    'CREATE UNIQUE INDEX idx_compat_preferences_owner ON compat_preferences (owner)',
  ]
  preferences.listRule = 'owner = @request.auth.id'
  preferences.viewRule = 'owner = @request.auth.id'
  preferences.createRule = 'owner = @request.auth.id'
  preferences.updateRule = 'owner = @request.auth.id && @request.body.owner:isset = false'
  preferences.deleteRule = 'owner = @request.auth.id'
  app.save(preferences)
}, (app) => {
  for (const name of ['compat_preferences', 'compat_widgets', 'compat_dashboards']) {
    try { app.delete(app.findCollectionByNameOrId(name)) } catch (_) {}
  }
  const users = app.findCollectionByNameOrId('users')
  users.fields.removeByName('displayName')
  users.fields.removeByName('onboardingCompleted')
  app.save(users)
})
`.trimStart())
}

const createAuthOnboardingMigrations = async (migrationsDir: string) => {
  await writeFile(join(migrationsDir, '001_batch_settings_baseline.js'), `
migrate((app) => {
  const settings = app.settings()
  settings.batch.enabled = false
  settings.batch.maxRequests = 7
  settings.batch.timeout = 13
  settings.batch.maxBodySize = 4096
  app.save(settings)
}, () => {})
`.trimStart())
  await writeFile(
    join(migrationsDir, '20260911180000_auth_onboarding.js'),
    await readFile(resolve('pb_migrations/20260911180000_auth_onboarding.js'), 'utf8'),
  )
}

const createHooks = async (hooksDir: string) => {
  await writeFile(join(hooksDir, 'compatibility.pb.js'), `
onRecordUpdateRequest((e) => {
  const info = e.requestInfo()
  const ownerIds = e.record.getStringSlice('owner')
  const owner = ownerIds.length > 0 ? ownerIds[0] : e.record.getString('owner')
  if (!info.auth || owner !== info.auth.id) {
    throw new Error('invalid preference owner')
  }
  if (e.record.getString('label') === 'block-by-hook') {
    throw new Error('compat hook blocked preference update')
  }
  e.next()
}, 'compat_preferences')

onRecordUpdateRequest((e) => {
  const info = e.requestInfo()
  if (!info.auth || e.record.id !== info.auth.id) {
    throw new Error('invalid user update')
  }
  if (e.record.getString('displayName') === 'block-finalization') {
    throw new Error('compat hook blocked finalization')
  }
  e.next()
}, 'users')
`.trimStart())
}

const createHarness = async (createMigrations = createMigration): Promise<Harness> => {
  const root = await mkdtemp(join(tmpdir(), 'kunai-pb-compat-'))
  const migrationsDir = join(root, 'migrations')
  const hooksDir = join(root, 'hooks')
  const dataDir = join(root, 'data')
  await mkdir(migrationsDir)
  await mkdir(hooksDir)
  await mkdir(dataDir)

  const binary = await downloadPocketBase(root)
  await createMigrations(migrationsDir)
  await createHooks(hooksDir)

  const port = 18_000 + Math.floor(Math.random() * 20_000)
  const baseUrl = `http://127.0.0.1:${port}`
  const harness = { root, binary, dataDir, migrationsDir, hooksDir, port, baseUrl }
  harnesses.push(harness)
  return harness
}

const startServer = async (harness: Harness, migrationsDir = harness.migrationsDir) => {
  harness.server = spawn(harness.binary, [
    'serve',
    `--http=127.0.0.1:${harness.port}`,
    `--dir=${harness.dataDir}`,
    `--migrationsDir=${migrationsDir}`,
    `--hooksDir=${harness.hooksDir}`,
    '--dev=false',
  ], { stdio: 'pipe' })

  await waitForHealth(harness.baseUrl)
}

const stopServer = async (harness: Harness) => {
  if (!harness.server || harness.server.killed) {
    return
  }
  harness.server.kill('SIGTERM')
  await wait(300)
  if (!harness.server.killed) {
    harness.server.kill('SIGKILL')
  }
}

const expectClientError = async (operation: Promise<unknown>, statuses: number[]) => {
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

const superuserClient = async (baseUrl: string) => {
  const pb = new PocketBase(baseUrl, new BaseAuthStore())
  pb.autoCancellation(false)
  await pb.collection('_superusers').authWithPassword(SUPERUSER_EMAIL, SUPERUSER_PASSWORD)
  return pb
}

const normalClient = async (baseUrl: string, email: string): Promise<{ pb: PocketBase, user: NormalUser }> => {
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

const createNormalUser = async (admin: PocketBase, email: string) => {
  const user = await admin.collection('users').create({
    email,
    password: USER_PASSWORD,
    passwordConfirm: USER_PASSWORD,
    displayName: email,
  })
  return user.id as string
}

describe('PocketBase auth onboarding migration batch settings', () => {
  it('leaves existing global batch settings untouched during schema up/down/up', async () => {
    const harness = await createHarness(createAuthOnboardingMigrations)

    run(harness.binary, ['migrate', 'up', `--dir=${harness.dataDir}`, `--migrationsDir=${harness.migrationsDir}`])
    run(harness.binary, ['superuser', 'upsert', SUPERUSER_EMAIL, SUPERUSER_PASSWORD, `--dir=${harness.dataDir}`])
    await startServer(harness)
    const initialAdmin = await superuserClient(harness.baseUrl)
    expect((await initialAdmin.settings.getAll()).batch).toEqual({
      enabled: false,
      maxRequests: 7,
      timeout: 13,
      maxBodySize: 4096,
    })
    await expectClientError(initialAdmin.collections.getOne('auth_onboarding_migration_state'), [404])

    await stopServer(harness)
    const down = spawnSync(harness.binary, [
      'migrate',
      'down',
      `--dir=${harness.dataDir}`,
      `--migrationsDir=${harness.migrationsDir}`,
    ], {
      encoding: 'utf8',
      env: { ...process.env, KUNAI_ALLOW_DESTRUCTIVE_MIGRATION_DOWN: '1' },
      input: 'y\n',
    })
    expect(down.status, `${down.stdout}\n${down.stderr}`).toBe(0)

    const pausedMigrationsDir = join(harness.root, 'paused-migrations')
    await mkdir(pausedMigrationsDir)
    await startServer(harness, pausedMigrationsDir)
    const afterDownAdmin = await superuserClient(harness.baseUrl)
    expect((await afterDownAdmin.settings.getAll()).batch).toEqual({
      enabled: false,
      maxRequests: 7,
      timeout: 13,
      maxBodySize: 4096,
    })

    await stopServer(harness)
    run(harness.binary, ['migrate', 'up', `--dir=${harness.dataDir}`, `--migrationsDir=${harness.migrationsDir}`])
    await startServer(harness)
    const reappliedAdmin = await superuserClient(harness.baseUrl)
    expect((await reappliedAdmin.settings.getAll()).batch).toEqual({
      enabled: false,
      maxRequests: 7,
      timeout: 13,
      maxBodySize: 4096,
    })
  }, 180_000)
})

describe('PocketBase 0.40.3 compatibility spike', () => {
  let harness: Harness
  let admin: PocketBase
  let userA: NormalUser
  let userB: NormalUser
  let clientA: PocketBase
  let clientB: PocketBase
  let dashboardA: { id: string }
  let dashboardB: { id: string }

  beforeAll(async () => {
    harness = await createHarness()

    const version = run(harness.binary, ['--version'])
    expect(version.stdout.trim()).toBe(`pocketbase version ${POCKETBASE_VERSION}`)

    const generated = spawnSync(harness.binary, [
      'migrate',
      'create',
      'generated_probe',
      `--dir=${join(harness.root, 'probe-data')}`,
      `--migrationsDir=${join(harness.root, 'probe-migrations')}`,
    ], { input: 'y\n', encoding: 'utf8' })
    expect(generated.status).toBe(0)
    const probeFiles = await readdir(join(harness.root, 'probe-migrations'))
    const generatedMigration = await readFile(join(harness.root, 'probe-migrations', probeFiles[0] ?? ''), 'utf8')
    expect(String(generated.stdout)).toContain('Successfully created file')
    expect(generatedMigration).toContain('migrate((app) =>')

    run(harness.binary, ['migrate', 'up', `--dir=${harness.dataDir}`, `--migrationsDir=${harness.migrationsDir}`])
    run(harness.binary, ['migrate', 'down', `--dir=${harness.dataDir}`, `--migrationsDir=${harness.migrationsDir}`])
    run(harness.binary, ['migrate', 'up', `--dir=${harness.dataDir}`, `--migrationsDir=${harness.migrationsDir}`])
    run(harness.binary, ['superuser', 'upsert', SUPERUSER_EMAIL, SUPERUSER_PASSWORD, `--dir=${harness.dataDir}`])

    await startServer(harness)
    admin = await superuserClient(harness.baseUrl)
    await admin.settings.update({ batch: { enabled: true, maxRequests: 10, timeout: 5, maxBodySize: 0 } })
    await createNormalUser(admin, 'compat-a@example.test')
    await createNormalUser(admin, 'compat-b@example.test')
    const authA = await normalClient(harness.baseUrl, 'compat-a@example.test')
    const authB = await normalClient(harness.baseUrl, 'compat-b@example.test')
    clientA = authA.pb
    clientB = authB.pb
    userA = authA.user
    userB = authB.user
  }, 180_000)

  afterAll(async () => {
    for (const item of harnesses) {
      await stopServer(item)
      if (existsSync(item.root)) {
        await rm(item.root, { recursive: true, force: true })
      }
    }
  })

  it('validates runtime, migrations, SDK auth store, auth refresh, and local auth clearing', async () => {
    expect(admin.authStore.isSuperuser).toBe(true)

    const usersCollection = await admin.collections.getOne('users')
    expect(usersCollection.type).toBe('auth')
    expect(usersCollection.fields.map((field: { name: string }) => field.name)).toEqual(
      expect.arrayContaining(['displayName', 'onboardingCompleted']),
    )

    const dashboardsCollection = await admin.collections.getOne('compat_dashboards')
    expect(dashboardsCollection.indexes.join('\n')).toContain('idx_compat_dashboards_owner_seed')

    expect(clientA.authStore.token).toBe(userA.token)
    expect(clientA.authStore.record?.id).toBe(userA.id)

    const requestScopedStore = new BaseAuthStore()
    requestScopedStore.save(clientA.authStore.token, clientA.authStore.record)
    const requestScopedClient = new PocketBase(harness.baseUrl, requestScopedStore)
    requestScopedClient.autoCancellation(false)
    const refreshed = await requestScopedClient.collection('users').authRefresh()
    expect(refreshed.record.id).toBe(userA.id)
    expect(requestScopedClient.authStore.isValid).toBe(true)
    requestScopedClient.authStore.clear()
    expect(requestScopedClient.authStore.token).toBe('')
    expect(requestScopedClient.authStore.record).toBeNull()
  })

  it('validates owner-scoped access rules and cross-owner relation protection', async () => {
    dashboardA = await clientA.collection('compat_dashboards').create({
      owner: userA.id,
      name: 'Home A',
      seedKey: 'home',
    })
    dashboardB = await clientB.collection('compat_dashboards').create({
      owner: userB.id,
      name: 'Home B',
      seedKey: 'home',
    })

    await expectClientError(
      clientA.collection('compat_dashboards').create({ owner: userB.id, name: 'Forged', seedKey: 'forged' }),
      [400, 403],
    )
    await expectClientError(clientA.collection('compat_dashboards').getOne(dashboardB.id), [403, 404])
    await expectClientError(clientA.collection('compat_dashboards').update(dashboardA.id, { owner: userB.id }), [400, 403, 404])
    await expectClientError(
      clientA.collection('compat_widgets').create({
        owner: userA.id,
        dashboard: dashboardB.id,
        type: 'weather',
        seedKey: 'weather',
        config: { version: 1 },
      }),
      [400, 403],
    )

    const widgetA = await clientA.collection('compat_widgets').create({
      owner: userA.id,
      dashboard: dashboardA.id,
      type: 'search',
      seedKey: 'search',
      config: { version: 1 },
    })
    expect(widgetA.id).toBeTruthy()

    const listA = await clientA.collection('compat_dashboards').getList(1, 20)
    expect(listA.items.map((item) => item.id)).toContain(dashboardA.id)
    expect(listA.items.map((item) => item.id)).not.toContain(dashboardB.id)
  })

  it('validates batch rollback and hook rejection semantics for partial errors', async () => {
    const isolatedDashboardA = await clientA.collection('compat_dashboards').create({
      owner: userA.id,
      name: 'Batch Home A',
      seedKey: 'batch-home-a',
    })
    const isolatedDashboardB = await clientB.collection('compat_dashboards').create({
      owner: userB.id,
      name: 'Batch Home B',
      seedKey: 'batch-home-b',
    })

    expect(isolatedDashboardA.id).toBeTruthy()

    const batch = clientA.createBatch()
    batch.collection('compat_preferences').create({ owner: userA.id, label: 'batch-created' })
    batch.collection('compat_widgets').create({
      owner: userA.id,
      dashboard: isolatedDashboardB.id,
      type: 'clock',
      seedKey: 'clock',
      config: { version: 1 },
    })

    await expectClientError(batch.send(), [400])

    const preferences = await clientA.collection('compat_preferences').getList(1, 20)
    expect(preferences.items).toHaveLength(0)

    const preference = await clientA.collection('compat_preferences').create({ owner: userA.id, label: 'valid' })
    await expectClientError(clientA.collection('compat_preferences').update(preference.id, { label: 'block-by-hook' }), [400])
    const reloaded = await clientA.collection('compat_preferences').getOne(preference.id)
    expect(reloaded.label).toBe('valid')

    const finalizationBatch = clientA.createBatch()
    finalizationBatch.collection('compat_preferences').update(preference.id, { label: 'attempted-finalization' })
    finalizationBatch.collection('users').update(userA.id, { displayName: 'block-finalization' })
    await expectClientError(finalizationBatch.send(), [400])
    const afterRollback = await clientA.collection('compat_preferences').getOne(preference.id)
    expect(afterRollback.label).toBe('valid')
  })

  it('validates unique-constraint concurrency and recovery by exact owner/seed identity', async () => {
    const [first, second] = await Promise.allSettled([
      clientA.collection('compat_dashboards').create({ owner: userA.id, name: 'Concurrent', seedKey: 'concurrent' }),
      clientA.collection('compat_dashboards').create({ owner: userA.id, name: 'Concurrent', seedKey: 'concurrent' }),
    ])

    const fulfilled = [first, second].filter((result) => result.status === 'fulfilled')
    const rejected = [first, second].filter((result) => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const existing = await clientA.collection('compat_dashboards').getFirstListItem(
      clientA.filter('owner = {:owner} && seedKey = {:seedKey}', { owner: userA.id, seedKey: 'concurrent' }),
    )
    expect(existing.id).toBe((fulfilled[0] as PromiseFulfilledResult<{ id: string }>).value.id)
  })
})
