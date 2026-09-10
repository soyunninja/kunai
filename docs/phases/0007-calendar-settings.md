# Phase 0007 — Google Calendar & Integration Settings

Change name: `phase-0007-calendar-settings`

Status: Planned

Depends on: Phase 0005; Phase 0006 not strictly required

## Objective

Connect Google Calendar safely and complete the settings areas required by implemented integrations.

## Google Calendar

- read-only OAuth scopes;
- connect/reconnect/disconnect;
- list accessible calendars;
- user selects visible calendars;
- Calendar widget shows next 3 days;
- size-aware date grouping;
- no event creation/editing.

## Settings consolidation

Ensure settings UX contains implemented sections for:

- profile/avatar/location/timezone;
- appearance;
- dashboards;
- search;
- weather;
- markets;
- calendar.

AI settings may be completed in Phase 0008 when credentials become operational.

## Required design work

- OAuth callback/session design;
- token storage/refresh;
- server-only access rules;
- event retrieval/cache strategy;
- legal Calendar widget sizes.

## Must not include

- Gmail/email;
- Calendar write scopes;
- event creation/editing;
- permanent mirroring of all events into PocketBase.
