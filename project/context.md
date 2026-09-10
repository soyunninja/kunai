# Current Project Context

## Project

Browser Startup Page — working title.

The final product name is intentionally undecided and is not a blocker.

## Current stage

Product discovery is sufficiently defined to start implementation using SDD.

No application code should be assumed to exist before Phase 0001.

## Active phase

`0001 — Foundation`

Phase brief:

`docs/phases/0001-foundation.md`

Expected SDD change name:

`phase-0001-foundation`

## Current goal

Create the smallest maintainable Nuxt/PocketBase foundation that can support the later dashboard/widget product without prematurely implementing product features.

## SDD mode

Artifact store: `openspec`.

Reason: the owner explicitly wants durable, versioned files that let Pi/gentle-ai understand the project and its development history without depending on chat context.

## Accepted stack

- Nuxt 4
- Vue 3
- TypeScript
- Tailwind CSS 4
- PocketBase
- pnpm

## Product summary

A configurable browser startup page / personal command center.

Each authenticated user owns a fully private personal space with multiple dashboard tabs. There is no sharing/collaboration model.

New users start with one `Home` dashboard containing Search, Local Clock, Local Weather, and Bookmarks.

Dashboards are assembled from reusable widget instances on an 8-column desktop/tablet grid. The page may scroll vertically without a fixed row count. Widget height is globally capped at 3 rows, and each widget type declares its own allowed sizes.

## Primary device priorities

1. Desktop
2. Tablet
3. Mobile

Mobile remains supported but is not the primary density/design target.

## Deferred product areas

- projects/tasks/time tracking;
- clients;
- collaboration/workspaces;
- email;
- service monitoring;
- general notes;
- large developer tool catalog;
- Japan event/matsuri feed;
- train planning;
- offline/PWA.

## Next action

Run the gentle-ai SDD flow for `phase-0001-foundation`.

Do not start Phase 0002 until Phase 0001 is verified and archived.
