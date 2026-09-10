# PocketBase Data Model — Target MVP

This document describes the intended data model. Exact PocketBase migration syntax belongs to the relevant SDD design/apply phase.

## Ownership principle

All normal user data is private to one authenticated user.

Every user-owned record must carry an `owner` relation to the auth collection unless ownership is safely implied by a relation whose rules enforce the same boundary.

Prefer explicit owner fields for simpler rules and debugging.

## `users` — auth collection

PocketBase auth collection.

Application profile fields may include:

- `displayName`
- `avatarKey`
- `timezone`
- `onboardingCompleted`

Avoid storing arbitrary uploaded avatar files in MVP. `avatarKey` references bundled 8-bit assets.

Public self-registration is not required in the MVP.

## `user_preferences`

One record per user.

Suggested fields:

- `owner` relation -> users, unique
- `appearance`: `dark | light | system`
- `defaultLocation` JSON containing stable location label + coordinates
- other truly global user preferences only when they do not belong to a widget instance

Do not turn this into an unstructured dumping ground.

## `dashboards`

Fields:

- `owner` relation -> users
- `name`
- `sortOrder`
- `created`
- `updated`

Optional fields such as slug/icon should only be added if the UX/spec requires them.

A dashboard belongs to exactly one user.

## `dashboard_widgets`

Fields:

- `owner` relation -> users
- `dashboard` relation -> dashboards
- `type` stable string identifier
- `config` JSON
- `layoutDesktop` JSON
- `layoutTablet` JSON
- `layoutMobile` JSON
- `created`
- `updated`

### Layout payload

A device layout should contain only the information necessary to validate/place the widget, typically:

```json
{
  "x": 0,
  "y": 0,
  "w": 2,
  "h": 1
}
```

The widget registry remains authoritative for whether `w/h` is legal for that type.

Do not trust stored layout JSON without validation.

### Config payload

Instance-specific widget configuration lives here when it has no independent lifecycle/query value.

Examples:

- Clock time zones
- Weather location
- Currency pair
- Multi-weather places
- Calendar presentation options

Do not store normalized bookmark or secret records inside this JSON.

## `bookmark_categories`

Fields:

- `owner`
- `name`
- `sortOrder`

Category is optional from a bookmark's perspective.

## `bookmarks`

Fields:

- `owner`
- `category` optional relation -> bookmark_categories
- `name`
- `url`
- `sortOrder`

Do not store a manually uploaded icon in MVP.

Favicon is derived at presentation/runtime level from the URL with a deterministic fallback.

## `search_engines`

User-configurable external search aliases.

Suggested fields:

- `owner`
- `name`
- `alias`
- `urlTemplate`
- `sortOrder`
- `enabled`

Google is the default behavior. It may be seeded as a record or represented as a built-in default; the phase design must choose one consistent approach.

`urlTemplate` must have a safe, documented query placeholder contract.

## `scratchpad_entries`

Purpose: lightweight scratchpad content/history only.

Suggested fields:

- `owner`
- `widget` relation -> dashboard_widgets
- `content`
- `archivedAt` nullable
- `created`
- `updated`

Invariant: one active (`archivedAt = null`) entry per Scratchpad widget instance.

The app must preserve this narrow scope and not evolve it into a general notes model during MVP work.

## `market_watchlist_items`

Central user list managed in Settings > Markets.

Suggested fields:

- `owner`
- `symbol`
- `displayName` optional
- `sortOrder`
- `enabled`

Markets widget configuration may reference/select watchlist items or use the user's current tracked list, depending on the Phase 0006 design. Multiple symbols in one widget is required.

## Calendar preference records

Use explicit collections/fields for:

- user's Google connection metadata;
- selected external calendar IDs;
- display preferences if needed.

Sensitive OAuth credentials/tokens must be server-only and not readable via normal user API rules.

The exact token storage strategy is resolved in Phase 0007.

## AI credential/settings records

AI settings require:

- owner;
- provider;
- model;
- optional endpoint/base URL if the selected provider design supports it;
- encrypted credential material.

Credential records MUST NOT be readable from browser-side PocketBase API calls.

Encryption keys MUST live outside PocketBase and source control.

## Data intentionally not persisted by default

Do not create historical collections for these unless a later spec requires them:

- weather observations;
- stock prices;
- exchange rates;
- Google Calendar event copies;
- generated passwords;
- AI translation history.

Transient caching may be introduced as an implementation concern when justified, but it is not user-domain history.

## Access rule intent

For normal owner collections, list/view/create/update/delete rules must ensure authenticated owner isolation.

Never rely on the frontend to filter another user's records after retrieval.

Server-only sensitive collections should deny normal client access and be reachable only through trusted server operations.
