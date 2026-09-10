# Architecture Overview

## Goal

Keep the app simple enough for a personal startup page while creating clear boundaries for user data, reusable widgets, and external integrations.

## Runtime shape

```text
Browser
  |
  | Nuxt UI / client interactions
  v
Nuxt 4 application
  |\
  | \__ server routes/services for sensitive external integrations
  |
  +---- PocketBase SDK/data-access boundary
             |
             v
         PocketBase
```

External providers are called through explicit app adapters, especially when secrets, OAuth tokens, normalization, caching, or rate limits are involved.

## Main responsibilities

### Nuxt client/UI

Responsible for:

- dashboard rendering;
- edit mode;
- widget interactions;
- responsive/device layout selection;
- user-facing settings;
- browser geolocation permission;
- local-only tools such as Password Generator.

Not responsible for:

- holding server-only provider secrets;
- bypassing PocketBase owner rules;
- interpreting raw provider contracts in arbitrary components.

### Nuxt server

Responsible for sensitive/provider boundaries such as:

- AI requests using stored user credentials;
- Google Calendar OAuth/token handling as required;
- provider requests that require private API keys;
- normalization/caching policies chosen in later phases.

### PocketBase

Responsible for:

- authentication;
- persistent user-owned data;
- access-rule enforcement;
- dashboard/widget configuration;
- bookmarks;
- settings/preferences;
- integration metadata/secrets according to server-only access rules.

## Data access rule

Do not create PocketBase SDK clients ad hoc inside components.

Use a small, consistent data-access layer/composables/services that expose application-level operations.

## Dashboard model

Dashboard behavior is data-driven.

Do not create separate hard-coded page architectures for Home, Travel, or Dev.

The route/shell resolves a dashboard record and renders its widget instances through the common widget registry and grid engine.

## External data rule

Weather, currency, markets, calendar, AI, and holiday data must be normalized before widget presentation.

Provider response shape must not leak into general widget code.

## Failure isolation

A widget integration error must not take down the full dashboard.

Each integration-backed widget needs independent loading, empty, stale (if caching exists), and error states.
