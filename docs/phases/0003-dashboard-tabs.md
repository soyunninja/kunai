# Phase 0003 — Dashboard Tabs & Shell

Change name: `phase-0003-dashboard-tabs`

Status: Planned

Depends on: Phase 0002

## Objective

Make dashboards real user-owned records and implement the top-level navigation/lifecycle before the grid engine.

## Must include

- dashboard list for current user;
- switch active dashboard;
- create empty dashboard;
- rename;
- reorder tabs;
- remove dashboard according to resolved Home rule;
- compact top navigation;
- `+`, `edit`, and `settings` entry points;
- persistent active/default behavior if required by design;
- settings shell/navigation with terminal-inspired style.

## Important rule

Travel and Dev are not hard-coded pages. A dashboard is generic data.

## Must not include

- drag/resize grid;
- real widget catalog behavior;
- Travel/Dev dashboards auto-created;
- external providers.

## Blocking decision to resolve

- whether `Home` itself can be renamed/deleted, and what invariant prevents a user ending with an unusable zero-dashboard state.

## Acceptance direction

- only current user's dashboards appear;
- tab order persists;
- creation is minimal;
- navigation works on desktop/tablet/mobile;
- no product-specific dashboard route architecture is introduced.
