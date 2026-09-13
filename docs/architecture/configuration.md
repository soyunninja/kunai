# Configuration Boundaries

## Runtime configuration

Environment variables are for installation/server configuration and secrets that belong to the deployment.

Phase 0001 implements one private server runtime value:

| Environment variable | Nuxt key | Phase 0001 exposure |
| --- | --- | --- |
| `NUXT_POCKETBASE_URL` | `runtimeConfig.pocketbaseUrl` | Private server configuration only |

The Foundation validates this endpoint at Nitro server startup without network I/O. It accepts absolute HTTP/HTTPS endpoints with optional ports and path prefixes, and rejects credentials, query parameters, fragments, or malformed values. It does not choose the authentication, session, SDK, or ordinary user-data access strategy; Phase 0002 owns that decision. Secret-requiring operations remain server-side.

Only explicitly public values may be exposed through Nuxt public runtime config. Phase 0001 declares no application public runtime keys.

## PocketBase batch prerequisite

Phase 0002 onboarding completion uses PocketBase native batch for its approved four-operation finalization boundary. This is an operational prerequisite, not schema state.

Required global PocketBase settings:

- `batch.enabled = true`
- `batch.maxRequests >= 4`

Do not rely on the Phase 0002 schema migration to change these values. PocketBase batch settings apply to the whole PocketBase instance, not only onboarding collections. Operators must configure the instance deliberately before serving the application.

The PocketBase hook startup preflight fails fast with a safe operational error if batch is disabled or `maxRequests` is below 4. The application does not auto-modify global PocketBase settings with superuser authority.

No concrete `batch.timeout` or `batch.maxBodySize` value is required by Phase 0002 beyond the deployment's normal PocketBase operational policy.

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
