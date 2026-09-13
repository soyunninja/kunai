# Configuration Boundaries

## Runtime configuration

Environment variables are installation/server configuration. They are not application state, are not browser configuration, and must not contain PocketBase user/admin passwords or bearer tokens.

Phase 0002 uses these private Nuxt runtime variables:

| Environment variable | Required | Scope | Nuxt key | Contract |
| --- | --- | --- | --- | --- |
| `NUXT_POCKETBASE_URL` | Yes | Runtime, development, test harness overrides | `runtimeConfig.pocketbaseUrl` | Absolute `http://` or `https://` PocketBase endpoint reachable by the Nuxt server. Credentials, query strings, and fragments are rejected. A path prefix is allowed for reverse-proxy deployments. |
| `NUXT_APP_ORIGIN` | Yes | Runtime, development, tests | `runtimeConfig.appOrigin` | Exact externally visible Nuxt application origin. It must be an absolute HTTP/HTTPS origin with no credentials, path, query, or fragment. |
| `NUXT_SESSION_COOKIE_MODE` | No | Runtime, development, tests | `runtimeConfig.sessionCookieMode` | Optional cookie mode. Empty/omitted means `secure`. Accepted values are `secure` and `development-http`. |

Cookie mode is validated with the app origin at Nitro startup:

- `secure` requires an HTTPS `NUXT_APP_ORIGIN` and uses the `__Host-kunai_session` cookie name with the Secure attribute.
- `development-http` requires an HTTP `NUXT_APP_ORIGIN`, uses the `kunai_session` cookie name, and is only for explicit local HTTP development.

Only explicitly public values may be exposed through Nuxt public runtime config. Phase 0002 declares no application-specific public runtime keys for PocketBase, sessions, or onboarding.

## Migration/test setup configuration

`KUNAI_ALLOW_DESTRUCTIVE_MIGRATION_DOWN` is not a normal runtime variable. It is read only by the Phase 0002 PocketBase migration `down` path and must be set to `1` before the migration allows destructive rollback.

Use it only in disposable rollback rehearsals and test harnesses. Do not use destructive `down` as a normal production rollback procedure.

## PocketBase compatibility

Phase 0002 was verified against:

| Component | Version |
| --- | --- |
| PocketBase server | `0.40.3` |
| JavaScript SDK package `pocketbase` | `0.28.1` |

The integration harness downloads PocketBase `0.40.3` for Linux amd64, verifies the pinned archive SHA-256, creates an isolated temporary data directory, applies migrations, serves PocketBase with repository hooks, creates test users, and removes the temporary directory during cleanup.

Do not document or depend on unimplemented future PocketBase versions for Phase 0002 behavior.

## PocketBase migration and hook order

For an application PocketBase instance, apply operational settings and schema before serving the Nuxt app against it:

1. Back up persistent PocketBase data before any schema change.
2. Configure the global PocketBase batch prerequisite.
3. Apply repository migrations from `pb_migrations/`.
4. Serve PocketBase with hooks from `pb_hooks/`.
5. Provision user accounts administratively.
6. Start Nuxt with the private runtime variables above.

The Phase 0002 migration extends the built-in `users` auth collection and creates `user_preferences`, `dashboards`, and `dashboard_widgets` with owner-scoped access rules and seed uniqueness indexes.

The Phase 0002 hook validates onboarding profile updates and runs a startup preflight for the batch prerequisite. Hooks must be loaded for the verified onboarding boundary.

## PocketBase batch prerequisite

Phase 0002 onboarding completion uses PocketBase native batch for its approved four-operation finalization boundary. This is an operational prerequisite, not schema state.

Required global PocketBase settings:

- `batch.enabled = true`
- `batch.maxRequests >= 4`

Do not rely on the Phase 0002 schema migration to change these values. PocketBase batch settings apply to the whole PocketBase instance, not only onboarding collections. Operators must configure the instance deliberately before serving the application.

The PocketBase hook startup preflight fails fast with a safe operational error if batch is disabled or `maxRequests` is below 4. The application does not auto-modify global PocketBase settings with superuser authority.

No concrete `batch.timeout` or `batch.maxBodySize` value is required by Phase 0002 beyond the deployment's normal PocketBase operational policy.

## Account provisioning

Phase 0002 implements no public registration flow. Users are created administratively through PocketBase setup/operations before they can log in.

Superuser/admin authority is limited to setup and operational administration, such as creating development users or applying instance settings. Normal application runtime operations must use the authenticated user's PocketBase identity and must not use a shared admin token as a privileged application proxy.

This repository's integration harness provisions disposable test users through helper code after creating a temporary superuser. It does not provide a production user-management CLI.

## Timezone manifest updates

Timezone validation uses generated, versioned artifacts for both Nuxt/shared code and PocketBase hooks. The source is the exact development dependency version of `@vvo/tzdb`, which provides IANA-derived timezone identifiers. Production must not download or generate timezone data.

To update tzdata:

1. update the exact `@vvo/tzdb` version in `package.json`;
2. run `pnpm install`;
3. run `pnpm generate:timezones`;
4. review the generated diff in `shared/generated/timezones.ts` and `pb_hooks/lib/timezone-manifest.js`;
5. run the timezone parity and onboarding validation tests;
6. commit the dependency, lockfile, and generated artifacts together.

## User configuration

Stored in PocketBase and scoped to the user.

Examples:

- appearance;
- avatar key;
- timezone/location;
- dashboards;
- widget configs/layouts;
- bookmarks;
- search aliases;
- market watchlist;
- selected calendars;
- AI provider/model preferences.

## Widget configuration

Instance-specific settings stay with the widget instance unless the data has an independent lifecycle.

## Global vs instance rule

Do not create global settings merely because multiple widgets could use them.

Use a global preference only when the user conceptually configures it once for their personal space.

Examples:

- appearance: global;
- market watchlist: global central list;
- Weather city: normally widget-instance config, with onboarding/default location available as a convenience;
- Currency pair: widget-instance config.
