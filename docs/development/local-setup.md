# Local development setup

## Tested toolchain

| Tool | Exact version |
| --- | --- |
| Node.js | `24.18.0` |
| pnpm | `10.34.5` |
| PocketBase | `0.40.3` |

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

`.env` is local-only. Its one required value is `NUXT_POCKETBASE_URL`, an absolute HTTP or HTTPS PocketBase endpoint without credentials, query parameters, or fragments. Phase 0001 keeps it in private Nuxt runtime configuration; it is not a public runtime value or browser configuration value.

Run the application and quality checks:

```sh
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

The test and build commands validate application behavior and do not contact PocketBase. A reachable PocketBase service is not required for either command.

## PocketBase service

Run PocketBase independently when a local service is needed. The command may create ignored local `pb_data/`; it does not create application collections or product records.

```sh
pocketbase --version
pocketbase serve --http=127.0.0.1:8090 --dir=./pb_data --migrationsDir=./pb_migrations
curl --fail --silent --show-error http://127.0.0.1:8090/api/health
```

A successful health request confirms the independent service is listening. A refused connection or timeout means the service is unavailable, not that the Nuxt shell is invalid: a syntactically valid but stopped endpoint still permits the shell to render because Phase 0001 performs no network I/O.

## Troubleshooting runtime configuration

- **Missing endpoint:** copy `.env.example` to `.env` and provide `NUXT_POCKETBASE_URL`.
- **Invalid endpoint:** use an absolute `http://` or `https://` URL with no credentials, query, or fragment. Startup reports sanitized `NUXT_POCKETBASE_URL` guidance and never echoes the submitted value.
- **Unreachable endpoint:** start PocketBase separately or correct the host/port. No Foundation request is made to the endpoint, so Nuxt can serve the shell while the service is stopped.
- **Build succeeds but production fails:** this is expected for absent or malformed runtime configuration. Supply `NUXT_POCKETBASE_URL` to the production process; it is validated at server startup rather than build time.

## Production runtime configuration

Build without embedding local configuration:

```sh
pnpm build
NUXT_POCKETBASE_URL=https://pocketbase.example.com node .output/server/index.mjs
```

Set the endpoint in the deployment process environment. Do not add it to `runtimeConfig.public`, source control, or browser code. Authentication, sessions, the PocketBase SDK, and ordinary user-data access remain Phase 0002 decisions.

Future database changes follow [ADR 0008](../decisions/0008-pocketbase-migrations.md).
