# Configuration Boundaries

## Runtime configuration

Environment variables are for installation/server configuration and secrets that belong to the deployment.

Phase 0001 implements one private server runtime value:

| Environment variable | Nuxt key | Phase 0001 exposure |
| --- | --- | --- |
| `NUXT_POCKETBASE_URL` | `runtimeConfig.pocketbaseUrl` | Private server configuration only |

The Foundation validates this endpoint at Nitro server startup without network I/O. It accepts absolute HTTP/HTTPS endpoints with optional ports and path prefixes, and rejects credentials, query parameters, fragments, or malformed values. It does not choose the authentication, session, SDK, or ordinary user-data access strategy; Phase 0002 owns that decision. Secret-requiring operations remain server-side.

Only explicitly public values may be exposed through Nuxt public runtime config. Phase 0001 declares no application public runtime keys.

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
