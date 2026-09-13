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

Completed checkpoints:

1. PocketBase compatibility.
2. Schema + owner isolation.

Checkpoint 3 status:

Completed, reviewed, and acknowledged. Completed within Checkpoint 3:

- `5.3` — server-side session refresh races and request isolation.
- `7.1` — SSR and client-navigation RED state-machine tests.
- `7.2` — SSR session initialization, global middleware, and client session composable.

Current Phase 0002 status:

Checkpoint 4A — Onboarding persistence + atomic Home seed is implemented, reviewed, acknowledged, committed, and pushed by the owner.

Checkpoint 4B Task `10.2` onboarding UI is implemented with passing focused and full automated validation. It renders the real onboarding form, uses the owner-approved `avatar-01` through `avatar-10` assets, preserves the no-upload boundary, detects/corrects timezone without UTC fallback, requests geolocation only by explicit action, supports optional non-geocoded location labels, submits only the 4A DTO, and consumes the final `SafeSessionDto`. The deferred 9.2 desktop/tablet avatar visual inspection is recorded in `openspec/changes/phase-0002-auth-onboarding/checkpoint-4b-evidence.md`.

Task `13.1` RED is complete and reviewed. Task `13.2` GREEN is implemented: `GET /api/home` returns only the authenticated user's minimal initialized Home DTO with private no-store behavior and safe failures, while `app/pages/index.vue` renders a minimal protected Home confirmation plus accessible logout without dashboard tabs, grid, widget rendering, edit mode, provider behavior, or Settings shell.

Validation for `13.2`: focused Home/SSR tests passed, `pnpm lint` passed, `pnpm typecheck` passed, `pnpm build` passed, `git diff --check` passed, and a subsequent full `pnpm test` passed 223 tests. A previous full-suite run hit the historical `tests/integration/pocketbase/onboarding-concurrency.test.ts` conflicting-submit flake; diagnosis did not reproduce it, found no demonstrated root cause, and found no evidence that `13.2` caused it. The flake remains an observation, not a resolved defect.

Task `14.1` TRIANGULATE is implemented as security regression coverage only. New tests cover H3 route security with a disposable PocketBase harness, direct normal-token two-user isolation, Nuxt SSR leakage checks, browser/client static leakage checks, same-origin rejection, cookie shapes, mass-assignment attempts, invalid-session/outage behavior, `/api/home`, cache headers, and onboarding concurrency. It demonstrated one defect: `GET /api/auth/session` did not emit `Cache-Control: private, no-store` for valid, invalid, or outage responses.

Task `14.2` REFACTOR corrected that evidenced defect only: the session route now sets `Cache-Control: private, no-store` before resolution, consistently covering valid, invalid/expired, and PocketBase-outage responses. The 14.1 expected-failing assertion is now a normal passing assertion. The auth model, cookie strategy, PocketBase rules, and other production behavior are unchanged. Affected security/auth/session/home/onboarding suites passed 100 tests; full `pnpm test` passed 239 tests; `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` passed. Browser/proxy-real HTTPS behavior remains for 15.1 manual validation.

## Next action

Await native review closure for `14.2` before Task `15.1`. Do not start Phase 0003, commit, push, open a PR, or archive Phase 0002 without explicit approval.
