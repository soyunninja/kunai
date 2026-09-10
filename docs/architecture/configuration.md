# Configuration Boundaries

## Runtime configuration

Environment variables are for installation/server configuration and secrets that belong to the deployment.

Examples may include:

- PocketBase server URL;
- server encryption key;
- OAuth app credentials;
- provider app-level keys if a provider uses deployment credentials.

Only explicitly public values may be exposed through Nuxt public runtime config.

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
