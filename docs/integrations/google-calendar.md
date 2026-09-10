# Google Calendar Integration

## MVP scope

Read-only.

The Calendar widget shows events from the next 3 days.

The user chooses which accessible Google calendars contribute events.

## Settings

Settings > Calendar should provide:

- connection status;
- connect/reconnect;
- disconnect;
- calendar list;
- visible calendar selection.

## OAuth

Use the minimum Google Calendar scopes required for read-only behavior.

Do not request write scopes in MVP.

Tokens/secrets must remain behind trusted server boundaries.

## Widget

The widget should group upcoming events clearly by date when space permits.

Exact size variants are defined in Phase 0007.

## Data storage

Do not permanently mirror full Google event history into PocketBase in MVP.

Store connection metadata/preferences and use provider retrieval/caching as designed.
