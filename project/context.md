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

Continue Phase 0002 with Checkpoint 4A — Onboarding persistence + atomic Home seed when explicitly authorized. Owner-supplied avatar assets and stable keys are now available; Checkpoint 4B visual UI remains unstarted and still requires explicit authorization.

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

Completed checkpoints and task blocks through Task `18.1` are implemented, validated, reviewed where required, and acknowledged where review has completed.

Checkpoint 4A — Onboarding persistence + atomic Home seed is implemented, reviewed, acknowledged, committed, and pushed by the owner.

Checkpoint 4B onboarding UI is implemented with passing focused and full automated validation. It renders the real onboarding form, uses the owner-approved `avatar-01` through `avatar-10` assets, preserves the no-upload boundary, detects/corrects timezone without UTC fallback, requests geolocation only by explicit action, supports optional non-geocoded location labels, submits only the 4A DTO, and consumes the final `SafeSessionDto`. The deferred 9.2 desktop/tablet avatar visual inspection is recorded in `openspec/changes/phase-0002-auth-onboarding/checkpoint-4b-evidence.md`.

Task `13.2` GREEN is implemented: `GET /api/home` returns only the authenticated user's minimal initialized Home DTO with private no-store behavior and safe failures, while `app/pages/index.vue` renders a minimal protected Home confirmation plus accessible logout without dashboard tabs, grid, widget rendering, edit mode, provider behavior, or Settings shell.

Task `14.2` corrected the session cache-header defect demonstrated by 14.1: `GET /api/auth/session` now emits `Cache-Control: private, no-store` for valid, invalid/expired, and PocketBase-outage responses.

Task `15.1` manual browser validation is complete for the environment available during Phase 0002. Evidence is recorded in `openspec/changes/phase-0002-auth-onboarding/manual-browser-validation-evidence.md`. HTTPS/reverse-proxy validation was not available and remains explicitly pending for Hardening/Release.

Task `16.1` ADR 0009 is accepted and reviewed. Task `17.1` operational/setup documentation is updated and reviewed. Task `17.2` remains pending because its dependency requires all Phase 0002 validation to be accepted and SDD verification preparation to be complete.

Task `18.1` final automated validation is complete. Evidence is recorded in `openspec/changes/phase-0002-auth-onboarding/final-automated-validation-evidence.md`. Final commands passed: `pnpm lint`, `pnpm typecheck`, `pnpm test` (26 files, 242 tests), `pnpm build`, `git diff --check`, and the explicit disposable PocketBase integration command (7 files, 69 tests) covering compatibility, schema/owner isolation, auth/onboarding isolation, onboarding seed, onboarding concurrency, batch preflight, and Home route against real PocketBase.

Task `18.2` verification preparation is complete. Evidence is recorded in `openspec/changes/phase-0002-auth-onboarding/verification-evidence.md`. The packet maps 18 approved Phase 0002 requirements to implementation, tests, manual evidence where applicable, review evidence, and status. No critical blockers are known for `/sdd-verify`. HTTPS/reverse-proxy real deployment validation remains explicitly deferred to Hardening/Release and is not claimed as a real PASS.

The historical onboarding concurrency flake was reproduced and diagnosed as a transient seed-read race during concurrent completions. The fix re-reads and validates final persisted state before returning success, uses only bounded recovery for recoverable incomplete seed state, and preserves `seed_conflict` for real corrupt/incompatible seed state. Assertions were not relaxed. Post-fix validation included focal concurrent 10/10 PASS, full concurrency file 34/34 PASS, repeated full concurrency file 6/6 PASS, and no final repetition reproduced the flake.

Phase 0002 remains active and unarchived. Task `17.2` remains pending until separately authorized. Do not archive Phase 0002, start Phase 0003, commit, push, or open a PR without explicit owner authorization.

## Next action

Stop for owner authorization before Task `17.2`, `/sdd-verify`, archive, Phase 0003, commit, push, or PR. Phase 0002 is active and unarchived.
