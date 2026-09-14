# Current Project Context

## Project

Browser Startup Page — working title.

The final product name is intentionally undecided and is not a blocker.

## Current stage

Phase 0001 Foundation is verified and archived.

Phase 0002 Authentication & Onboarding is implementation-complete, automated-validation-complete, available-manual-validation-complete, has its verification packet prepared, and is ready for `/sdd-verify` on `feat/phase-0002-auth-onboarding`.

Phase 0002 is **not yet formally verified/accepted** and is **not archived**. Do not archive it, start Phase 0003, commit, push, or open a PR without explicit owner authorization.

## Active phase

`0002 — Authentication & Onboarding` (ready for verification)

Phase brief:

`docs/phases/0002-auth-onboarding.md`

OpenSpec change name:

`phase-0002-auth-onboarding`

Verification packet:

`openspec/changes/phase-0002-auth-onboarding/verification-evidence.md`

## Current goal

Await explicit owner authorization for `/sdd-verify` and any later archive/delivery action.

Do not start Phase 0003. Phase 0003 remains planned and not started.

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

## Current Phase 0002 ready-for-verification status

Phase 0002 implementation is complete for the approved Authentication & Onboarding scope, but the phase is not yet formally verified/accepted:

- login, logout, and session refresh are implemented through Nuxt server routes;
- the PocketBase bearer stays in an HttpOnly, SameSite=Lax, host-only application cookie;
- production secure-cookie behavior is implemented/configuration-tested, while development HTTP mode is explicit;
- browser-visible session state is limited to `SafeSessionDto`;
- each request uses a request-scoped PocketBase SDK client/AuthStore;
- normal user runtime operations use the authenticated user's PocketBase identity, not a superuser proxy;
- invalid/expired sessions and PocketBase outage semantics are implemented and tested;
- same-origin/CSRF protection and private/no-store cache behavior are implemented and tested;
- onboarding is implemented with display name, real bundled avatar registry, timezone validation, optional location, explicit geolocation, and recoverable UI states;
- the real avatar registry contains `avatar-01` through `avatar-10` and no upload path;
- the default Home seed creates exactly one Home dashboard and exactly one each of Search, Local Clock, Local Weather, and Bookmarks placeholders;
- the protected minimal Home route and landing are implemented without dashboard tabs, grid editing, functional widgets, providers, or Settings shell;
- multi-user/owner isolation is validated through direct normal-user PocketBase integration tests and server/SSR tests;
- Phase 0002 security coverage is validated, including CSRF, mass assignment, cross-request identity, token sentinel, SSR/client leakage, outage/expiry, and cache headers.

Validated runtime dependencies:

- PocketBase `0.40.3` is validated through the disposable integration harness.
- JavaScript SDK `pocketbase@0.28.1` is validated.
- ADR 0009 — Nuxt/PocketBase session boundary — is accepted.
- Operational/setup documentation is updated.

## Evidence status

Available evidence:

- `openspec/changes/phase-0002-auth-onboarding/compatibility-evidence.md`
- `openspec/changes/phase-0002-auth-onboarding/schema-owner-isolation-evidence.md`
- `openspec/changes/phase-0002-auth-onboarding/auth-session-boundary-evidence.md`
- `openspec/changes/phase-0002-auth-onboarding/checkpoint-4b-evidence.md`
- `openspec/changes/phase-0002-auth-onboarding/manual-browser-validation-evidence.md`
- `openspec/changes/phase-0002-auth-onboarding/final-automated-validation-evidence.md`
- `openspec/changes/phase-0002-auth-onboarding/verification-evidence.md`
- `docs/decisions/0009-nuxt-pocketbase-session-boundary.md`

Final automated validation is complete:

- `pnpm lint`: PASS;
- `pnpm typecheck`: PASS;
- `pnpm test`: PASS, 26 files / 242 tests;
- `pnpm build`: PASS;
- explicit disposable PocketBase integration: PASS, 7 files / 69 tests;
- `git diff --check`: PASS.

The explicit disposable PocketBase integration command covered compatibility, schema/owner isolation, auth/onboarding isolation, onboarding seed, onboarding concurrency, batch preflight, and Home route against real PocketBase.

No required integration test was silently skipped.

## Onboarding concurrency resolution

The historical onboarding concurrency flake was reproduced and diagnosed.

Cause: during two concurrent real PocketBase onboarding completions, the losing request could observe a transient incomplete/incompatible seed while the winning request was completing, then throw `OnboardingCompletionError` `seed_conflict` 409 even though the winning request left valid persisted final state.

Fix: `completeOnboarding` re-reads persisted state and validates final completed state before returning success. If state remains incomplete but recoverable, it uses only the bounded retry path. Real corrupt/incompatible completed seed still produces `seed_conflict`.

Post-fix validation:

- focal concurrent test: 10/10 PASS;
- full `onboarding-concurrency` file: 34/34 PASS;
- repeated full concurrency file: 6/6 PASS;
- required PocketBase cohort: PASS;
- no final repetition reproduced the flake.

## Manual validation and deferred deployment check

Available manual browser validation is complete for the local/dev HTTP + disposable PocketBase environment:

- login;
- session;
- onboarding;
- protected Home;
- logout;
- separate users;
- available geolocation/error paths;
- keyboard/touch basics;
- token/config exposure checks;
- outage and invalid-cookie semantics.

Deferred check:

- HTTPS/reverse-proxy real validation remains **PENDING** for Hardening/Release.
- It is not marked as PASS and was not simulated as a real deployment validation.

## Known limitations

Real known limitations:

- logout is local/stateless;
- no global centralized session revocation exists in Phase 0002;
- no public registration is implemented;
- Phase 0003 dashboard functionality is not implemented yet.

## Blockers

No critical blockers are known for running `/sdd-verify` on Phase 0002.

## Phase 0003 status

Phase 0003 — Dashboard tabs, lifecycle, navigation, settings shell — remains planned and not started.

No Phase 0003 implementation files have been created as part of Phase 0002 verification preparation.

## Next action

Stop for explicit owner authorization before `/sdd-verify`, archive, commit, push, PR, or Phase 0003 work.
