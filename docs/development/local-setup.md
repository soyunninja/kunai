# Local development setup

## Tested toolchain

| Tool | Exact version |
| --- | --- |
| Node.js | `24.18.0` |
| pnpm | `10.34.5` |
| PocketBase server | `0.40.3` |
| PocketBase JS SDK | `0.28.1` |

Install Node with the version in `.node-version`. Enable Corepack, then activate the pinned pnpm release:

```sh
corepack enable
corepack prepare pnpm@10.34.5 --activate
node --version
pnpm --version
```

Install the official PocketBase `0.40.3` archive for the target OS and architecture outside this repository. Verify its published SHA-256 checksum before placing the executable on `PATH`; do not commit the binary.

## Application setup

From the repository root, create local configuration and install exactly what the lockfile specifies:

```sh
cp .env.example .env
pnpm install --frozen-lockfile
```

`.env` is local-only and ignored. Use placeholders/local endpoints only. Do not place PocketBase superuser credentials, normal user passwords, bearer tokens, provider secrets, or OAuth tokens in `.env.example`.

For explicit local HTTP development, the required Nuxt values are:

```sh
NUXT_POCKETBASE_URL=http://127.0.0.1:8090
NUXT_APP_ORIGIN=http://localhost:3000
NUXT_SESSION_COOKIE_MODE=development-http
```

`NUXT_POCKETBASE_URL` must be an absolute HTTP or HTTPS PocketBase endpoint without credentials, query parameters, or fragments. `NUXT_APP_ORIGIN` must be the exact Nuxt application origin, without path, query, fragment, or credentials. `NUXT_SESSION_COOKIE_MODE` is optional; when omitted it defaults to `secure`, which requires an HTTPS `NUXT_APP_ORIGIN`. Use `development-http` only for local HTTP development.

Run the application and quality checks:

```sh
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

`pnpm test` includes real disposable PocketBase integration tests. It does not require a pre-running local PocketBase service, but it does require network access to download PocketBase `0.40.3` for Linux amd64, `unzip`, and permission to create temporary directories under the OS temp directory.

## PocketBase service for local application use

Run PocketBase independently when a local application service is needed. The commands below use ignored local `pb_data/`; do not point them at production data.

Configure the required global batch setting before serving the application. One safe development approach is to use the PocketBase Admin UI/settings for the local instance and set:

- `batch.enabled = true`
- `batch.maxRequests >= 4`

Then apply migrations and serve with repository hooks:

```sh
pocketbase --version
pocketbase migrate up --dir=./pb_data --migrationsDir=./pb_migrations
pocketbase serve --http=127.0.0.1:8090 --dir=./pb_data --migrationsDir=./pb_migrations --hooksDir=./pb_hooks
curl --fail --silent --show-error http://127.0.0.1:8090/api/health
```

The hook startup preflight fails fast if batch is disabled or `maxRequests` is below 4. Migrations create the Phase 0002 schema/rules; hooks enforce onboarding profile completion rules and the batch preflight.

## Account provisioning

Phase 0002 has no public registration page or public signup API. Create development users administratively in PocketBase before attempting application login.

Use PocketBase's own administrative UI or operational process for local user creation. This repository's automated integration harness creates a temporary superuser and test users programmatically for disposable tests, but it does not provide a production user-provisioning CLI.

Normal application runtime operations must use the authenticated user's PocketBase identity. Do not configure Nuxt with a shared admin token for normal reads/writes.

## Verified auth/onboarding/Home flow

The implemented Phase 0002 flow is:

```text
admin-provisioned user
→ login
→ server-owned session cookie
→ /api/auth/session projects SafeSessionDto
→ onboarding if incomplete
→ idempotent Home seed on completion
→ minimal protected Home when completed
```

The PocketBase bearer token is stored in an `HttpOnly`, `SameSite=Lax`, host-only application cookie and loaded only into a request-scoped server-side PocketBase SDK auth store. Browser JavaScript receives only `SafeSessionDto`; it cannot read the bearer token through `document.cookie`, web storage, Nuxt payload, or public runtime config.

Onboarding completion runs with the normal user's PocketBase token. It creates or validates user preferences, the `Home` dashboard seed, and four seeded widget records: Search, Local Clock, Local Weather, and Bookmarks. Those widget records are persisted but are not functional rendered dashboard widgets in Phase 0002.

`GET /api/home` is private/no-store and validates the existing Home seed. It does not create or repair state. Missing or inconsistent Home seed state returns a safe conflict response; PocketBase outage returns a safe unavailable response.

## Disposable integration test harness

The integration tests use a real PocketBase server, not mocks:

1. create a temporary isolated root/data directory;
2. download PocketBase `0.40.3` Linux amd64 and verify the pinned SHA-256;
3. configure disposable batch settings;
4. apply `pb_migrations/`;
5. start PocketBase with `pb_hooks/`;
6. create a temporary superuser and normal users;
7. run tests using normal user tokens for application behavior;
8. stop PocketBase and remove the temporary directory.

Focused commands for the verified Phase 0002 integration areas:

```sh
pnpm test tests/integration/pocketbase/compatibility.test.ts
pnpm test tests/integration/pocketbase/schema-owner-isolation.test.ts
pnpm test tests/integration/pocketbase/isolation/auth-onboarding.test.ts
pnpm test tests/integration/pocketbase/onboarding-concurrency.test.ts
pnpm test tests/integration/pocketbase/onboarding-seed.test.ts
pnpm test tests/integration/pocketbase/home-route.test.ts
pnpm test tests/server/security.test.ts tests/ssr/security.test.ts
```

The historical onboarding concurrency flake was not reproduced during the later Phase 0002 runs and has no demonstrated root cause. Do not document it as fixed unless a future task proves and fixes a cause.

## Production runtime configuration

Build without embedding local configuration:

```sh
pnpm build
NUXT_POCKETBASE_URL=https://pocketbase.example.com NUXT_APP_ORIGIN=https://app.example.com NUXT_SESSION_COOKIE_MODE=secure node .output/server/index.mjs
```

Set runtime values in the deployment process environment. Do not add them to `runtimeConfig.public`, source control, or browser code.

Production requires HTTPS, correct Host/Origin behavior, coherent forwarded protocol through the reverse proxy, Secure cookies, and same-origin protection. Real HTTPS/reverse-proxy validation remains PENDING for Hardening/Release because no real deployment was available during Phase 0002 validation. Do not weaken local or production cookie/origin settings to bypass that pending validation.

## Backup, recovery, and rollback

Back up persistent PocketBase data before applying schema changes.

Do not use destructive migration rollback as a normal production recovery procedure. The Phase 0002 migration `down` path refuses to run unless `KUNAI_ALLOW_DESTRUCTIVE_MIGRATION_DOWN=1` is set. That guard exists for explicit disposable rollback rehearsal, not for routine live data destruction.

Rehearse migrations and rollback behavior in disposable environments before touching persistent data.

## Troubleshooting runtime configuration

- **Missing endpoint:** copy `.env.example` to `.env` and provide `NUXT_POCKETBASE_URL`.
- **Invalid endpoint:** use an absolute `http://` or `https://` URL with no credentials, query, or fragment. Startup reports sanitized `NUXT_POCKETBASE_URL` guidance and never echoes the submitted value.
- **Missing or mismatched app origin:** provide `NUXT_APP_ORIGIN` as the exact externally visible Nuxt origin. Do not include a path, query, fragment, username, or password.
- **Cookie/HTTPS mismatch:** `secure` mode requires HTTPS. Local HTTP requires explicit `NUXT_SESSION_COOKIE_MODE=development-http`; production should use `secure`.
- **PocketBase unavailable:** start PocketBase or correct `NUXT_POCKETBASE_URL`. Session/Home may return `503`; a valid cookie is preserved during outage.
- **Same-origin rejection:** confirm browser requests send an Origin matching `NUXT_APP_ORIGIN` and that reverse-proxy Host/Origin/protocol handling is coherent.
- **Migrations/hooks not applied:** apply `pb_migrations/` and serve with `--hooksDir=./pb_hooks`. Missing hooks bypass the verified onboarding preflight/guard behavior.
- **Batch disabled:** set `batch.enabled=true` and `batch.maxRequests>=4`; otherwise the hook startup preflight fails.
- **Home seed inconsistent:** rerun through the verified onboarding path in a disposable environment. `GET /api/home` intentionally does not repair state.
- **401 vs 503:** `401` means unauthenticated or invalid local session; `503` means PocketBase/session/Home state could not be checked safely.

Future database changes follow [ADR 0008](../decisions/0008-pocketbase-migrations.md). The auth/session boundary follows [ADR 0009](../decisions/0009-nuxt-pocketbase-session-boundary.md).
