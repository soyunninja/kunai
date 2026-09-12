# Current Project Context

## Project

Browser Startup Page — working title.

The final product name is intentionally undecided and is not a blocker.

## Current stage

Phase 0001 Foundation is verified and archived. Phase 0002 Authentication & Onboarding is in apply on `feat/phase-0002-auth-onboarding`.

Phase 0002 completed Checkpoint 1 — PocketBase compatibility and Checkpoint 2 — Schema + owner isolation. Those checkpoints are implemented, reviewed, acknowledged, and committed on the current branch.

Checkpoint 3 — Auth/session boundary is completed, reviewed, and acknowledged. Tasks `5.3`, `7.1`, and `7.2` are complete. The next checkpoint is Checkpoint 4A — Onboarding persistence + atomic Home seed, which is no longer blocked by Checkpoint 3 dependencies.

The formal Checkpoint 4A / 4B split is documented in `openspec/changes/phase-0002-auth-onboarding/design.md` and `openspec/changes/phase-0002-auth-onboarding/tasks.md`.

## Active phase

`0002 — Authentication & Onboarding` (applying)

Phase brief:

`docs/phases/0002-auth-onboarding.md`

Expected SDD change name:

`phase-0002-auth-onboarding`

## Current goal

Continue Phase 0002 with Checkpoint 4A — Onboarding persistence + atomic Home seed when explicitly authorized. Checkpoint 4B remains blocked by owner-supplied avatar assets and stable keys.

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

## Current Phase 0002 status

Completed checkpoints:

1. PocketBase compatibility.
2. Schema + owner isolation.

Checkpoint 3 status:

Completed, reviewed, and acknowledged. Completed within Checkpoint 3:

- `5.3` — server-side session refresh races and request isolation.
- `7.1` — SSR and client-navigation RED state-machine tests.
- `7.2` — SSR session initialization, global middleware, and client session composable.

Next checkpoint:

Checkpoint 4A — Onboarding persistence + atomic Home seed is no longer blocked by Checkpoint 3 dependencies and may start only after explicit owner authorization.

Avatar assets and final stable keys do not block 4A. They continue to block Checkpoint 4B visual avatar/onboarding UI completion.

## Next action

Start Checkpoint 4A — Onboarding persistence + atomic Home seed next only when explicitly authorized. Do not implement Checkpoint 4B, start Phase 0003, commit, push, open a PR, or archive Phase 0002 without explicit approval.
