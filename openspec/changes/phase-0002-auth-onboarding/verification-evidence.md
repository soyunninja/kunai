# Phase 0002 Verification Evidence Packet

Change: `phase-0002-auth-onboarding`

Date: 2026-09-14

Purpose: provide the final SDD verification packet for `/sdd-verify` without archiving Phase 0002 or starting Phase 0003.

## Scope and source of truth

This packet maps the approved Phase 0002 OpenSpec requirements to implementation, automated tests, manual evidence, review checkpoints, and known limitations.

Primary sources reviewed:

- `openspec/changes/phase-0002-auth-onboarding/proposal.md`
- `openspec/changes/phase-0002-auth-onboarding/specs/authentication/spec.md`
- `openspec/changes/phase-0002-auth-onboarding/specs/onboarding/spec.md`
- `openspec/changes/phase-0002-auth-onboarding/specs/pocketbase-foundation/spec.md`
- `openspec/changes/phase-0002-auth-onboarding/specs/application-foundation/spec.md`
- `openspec/changes/phase-0002-auth-onboarding/design.md`
- `openspec/changes/phase-0002-auth-onboarding/tasks.md`
- `openspec/changes/phase-0002-auth-onboarding/compatibility-evidence.md`
- `openspec/changes/phase-0002-auth-onboarding/schema-owner-isolation-evidence.md`
- `openspec/changes/phase-0002-auth-onboarding/auth-session-boundary-evidence.md`
- `openspec/changes/phase-0002-auth-onboarding/checkpoint-4b-evidence.md`
- `openspec/changes/phase-0002-auth-onboarding/manual-browser-validation-evidence.md`
- `openspec/changes/phase-0002-auth-onboarding/final-automated-validation-evidence.md`
- `docs/decisions/0009-nuxt-pocketbase-session-boundary.md`
- `project/context.md`
- implemented code and tests under `app/`, `server/`, `shared/`, `pb_migrations/`, `pb_hooks/`, and `tests/`.

Phase 0002 remains active. This packet does not archive the change, does not declare Phase 0002 complete, and does not authorize Phase 0003.

## Requirement-to-evidence map

Status values:

- `VERIFIED`: implemented and covered by automated and/or manual evidence.
- `VERIFIED WITH DEFERRED DEPLOYMENT CHECK`: implementation and local/automated evidence are verified, but a real deployment check remains explicitly deferred.
- `BLOCKED`: a critical requirement lacks sufficient evidence.

| # | Requirement / spec | Implementation evidence | Tests / automated evidence | Manual evidence | Review evidence | Status |
|---:|---|---|---|---|---|---|
| 1 | Authentication — Administratively provisioned email/password authentication | `server/api/auth/login.post.ts`, `server/api/auth/logout.post.ts`, `server/utils/session.ts`; public registration/reset/social UX not implemented; ADR 0009 documents admin provisioning. | `tests/server/auth-session-boundary.test.ts`, `tests/server/auth-routes-h3.test.ts`, `tests/server/security.test.ts`, full `pnpm test`. | `15.1-LOGIN-A`, `15.1-LOGOUT`, `15.1-TWO-USERS`. | Auth/session checkpoint reviewed/acknowledged; ADR 0009 review `review-a67b87976ea12105`. | VERIFIED |
| 2 | Authentication — Protected navigation and session restoration | `app/plugins/session.server.ts`, `app/middleware/auth.global.ts`, `app/composables/useSession.ts`, `app/utils/auth-routing.ts`, pages under `app/pages/`. | `tests/ssr/auth-routing.nuxt.test.ts`, `tests/ssr/auth-routing.integration.nuxt.test.ts`, `tests/ssr/session-composable.nuxt.test.ts`, `tests/ssr/auth-middleware.nuxt.test.ts`. | `15.1-SESSION`, `15.1-SSR-VALID`, `15.1-STALE-TABS`. | Auth/session checkpoint reviewed/acknowledged. | VERIFIED |
| 3 | Authentication — Invalid and expired session handling | `server/utils/session.ts`, auth/session routes, SSR middleware invalid-session behavior. | `tests/server/auth-session-boundary.test.ts`, `tests/server/auth-routes-h3.test.ts`, `tests/server/security.test.ts`, SSR routing tests. | `15.1-INVALID-COOKIE`, `15.1-OUTAGE-COOKIE`. | Auth/session and security/manual validation reviews. | VERIFIED |
| 4 | Authentication — Server-owned bearer credential | `server/utils/session-config.ts`, `server/utils/session.ts`, `server/utils/pocketbase-client.ts`, private runtime config; no browser PocketBase SDK access path. | Cookie/security tests, token sentinel assertions, `tests/ssr/security.test.ts`, public runtime config guards, full `pnpm test`. | `15.1-COOKIE-DEV`, `15.1-TOKEN-EXPOSURE`; production Secure is configuration-verified, real HTTPS proxy deferred. | Auth/session review; security review; ADR 0009. | VERIFIED WITH DEFERRED DEPLOYMENT CHECK |
| 5 | Authentication — Safe session representation and request isolation | `shared/types/auth.ts`, `server/utils/session.ts`, `server/utils/pocketbase-client.ts`; request-scoped `BaseAuthStore`; no mutable global authenticated client. | `tests/server/auth-session-boundary.test.ts`, `tests/server/security.test.ts`, SSR A/B isolation coverage. | `15.1-TWO-USERS`, token/config exposure checks. | Auth/session checkpoint reviewed/acknowledged. | VERIFIED |
| 6 | Authentication — Same-origin protection for unsafe operations | `server/utils/same-origin.ts`, login/logout/onboarding route enforcement before mutation. | `tests/server/auth-routes-h3.test.ts`, `tests/server/security.test.ts`, same-origin/CSRF cases. | Manual login/logout flows exercised same-origin; no cross-origin manual bypass claimed. | Auth/session and security reviews. | VERIFIED |
| 7 | Authentication — Auth/session architecture decision record | `docs/decisions/0009-nuxt-pocketbase-session-boundary.md`, `docs/decisions/README.md`. | Link/path and statement cross-checks from Task 16.1. | Not applicable. | `review-a67b87976ea12105` approved/acknowledged. | VERIFIED |
| 8 | Onboarding — Minimal profile baseline | `shared/validation/onboarding.ts`, `shared/types/onboarding.ts`, `server/api/onboarding/*`, `server/utils/onboarding.ts`, PocketBase users fields/hooks. | `tests/unit/onboarding-validation.test.ts`, `tests/server/onboarding-routes.test.ts`, `tests/server/onboarding-complete.test.ts`, `tests/integration/pocketbase/onboarding-seed.test.ts`, `tests/integration/pocketbase/onboarding-concurrency.test.ts`. | `15.1-ONBOARDING-UI`, `15.1-ONBOARDING-COMPLETE`. | Checkpoint 4A/4B reviews; concurrency fix review `review-f95b75a0b45dc694`. | VERIFIED |
| 9 | Onboarding — Bundled avatar selection gate | `shared/avatars.ts`, generated/shared avatar artifacts, `pb_hooks/lib/avatar-manifest.js`, `app/components/AvatarPicker.vue`, `public/avatars/avatar-01.png` through `avatar-10.png`; no upload UI. | `tests/unit/avatar-registry.test.ts`, onboarding component tests, PocketBase hook validation through integration suites. | `checkpoint-4b-evidence.md` visual/structural avatar inspection; `15.1-ONBOARDING-UI`. | Avatar/Checkpoint 4B reviews. | VERIFIED |
| 10 | Onboarding — User-controlled location and timezone collection | `app/composables/useOnboarding.ts`, `app/pages/onboarding.vue`, shared validators, generated timezone artifacts; no provider/geocoder. | `tests/onboarding.nuxt.test.ts`, `tests/unit/timezone-manifest-parity.test.ts`, `tests/unit/onboarding-validation.test.ts`. | `15.1-GEO-UNAVAILABLE`, `15.1-GEO-DENIED`, reduced-motion/browser checks. | Checkpoint 4B review. | VERIFIED |
| 11 | Onboarding — Accessible and recoverable onboarding interaction | Onboarding page/composable, UI primitives under `app/components/ui/`, focus/live feedback and retry states. | `tests/onboarding.nuxt.test.ts`, route/server recoverable failure tests. | `15.1-KEYBOARD`, `15.1-TABLET-TOUCH`, `15.1-REDUCED-MOTION`. | Checkpoint 4B review. | VERIFIED |
| 12 | Onboarding — Idempotent initial Home seed | `server/utils/onboarding.ts`, `server/api/onboarding/complete.post.ts`, PocketBase seed indexes/rules/hooks. | `tests/integration/pocketbase/onboarding-seed.test.ts`, `tests/server/onboarding-complete.test.ts`, final explicit PB integration. | `15.1-HOME-PROTECTED`, `15.1-SSR-VALID`. | Checkpoint 4A review; concurrency fix review. | VERIFIED |
| 13 | Onboarding — Seed convergence and truthful completion | Durable unique indexes, load-or-create seed service, bounded final batch, PocketBase completion guard, concurrency fix in `completeOnboarding`. | `tests/integration/pocketbase/onboarding-concurrency.test.ts` 34 tests; final automation; post-fix focal 10/10 and repeated full file 6/6. | Manual completed Home flow after onboarding. | Checkpoint 4A review; `review-f95b75a0b45dc694` approved/acknowledged. | VERIFIED |
| 14 | Onboarding — Phase boundaries | Minimal Home landing, no dashboard editor/grid/widget engine/providers/settings/search-engine/bookmark functionality, no public auth flows or avatar upload. | UI/SSR/Home tests and absence/assertion checks in onboarding/home/theme suites. | Manual Home/onboarding inspection confirms no future-phase controls. | Checkpoint reviews; final validation review. | VERIFIED |
| 15 | PocketBase foundation — Owner-scoped onboarding persistence and direct API isolation | `pb_migrations/20260911180000_auth_onboarding.js`, `pb_hooks/auth_onboarding.pb.js`, `pb_hooks/lib/onboarding-validation.js`, normal-user data paths. | `tests/integration/pocketbase/schema-owner-isolation.test.ts`, `tests/integration/pocketbase/isolation/auth-onboarding.test.ts`, security tests. | `15.1-TWO-USERS`. | Schema + owner isolation checkpoint reviewed/acknowledged. | VERIFIED |
| 16 | PocketBase foundation — Server-side PocketBase configuration validation boundary | `server/utils/pocketbase.ts`, `server/plugins/pocketbase-config.ts`, `server/utils/pocketbase-client.ts`, private endpoint boundary. | `tests/pocketbase-config.test.ts`, auth/session boundary tests, public runtime config leakage tests. | `15.1-TOKEN-EXPOSURE`. | Foundation/auth-session reviews. | VERIFIED |
| 17 | PocketBase foundation — Explicit runtime configuration and secret boundary | `.env.example`, `docs/development/local-setup.md`, `docs/architecture/configuration.md`, `docs/architecture/security.md`, `server/utils/runtime-config.ts`; no committed secrets. | Static/config/security tests; Task 17.1 documentation cross-checks; final `pnpm lint/typecheck/test/build`. | Token/config exposure manual checks. | Operational docs review `review-292007caf1af70ef`. | VERIFIED WITH DEFERRED DEPLOYMENT CHECK |
| 18 | Application foundation — Authentication-aware application shell | `app/app.vue`, `app/pages/login.vue`, `app/pages/onboarding.vue`, `app/pages/index.vue`, route middleware; retained main landmark and appearance control. | `tests/home.nuxt.test.ts`, `tests/theme.nuxt.test.ts`, SSR routing tests, full `pnpm test`. | Manual browser Home/login/onboarding/logout flows. | Home and Checkpoint 4B reviews. | VERIFIED |

Requirements mapped: 18. Critical blockers: none.

## Auth/session evidence summary

Verified behavior:

- Login authenticates administratively provisioned PocketBase users through Nuxt server routes.
- Logout clears the local application session cookie and request auth store without promising global revocation.
- Session refresh uses PocketBase `users.authRefresh()` through a request-scoped SDK client/AuthStore.
- The bearer credential is stored only in an application session cookie.
- Cookie contract: `HttpOnly`, `SameSite=Lax`, path `/`, host-only/no `Domain`; production secure mode uses `__Host-kunai_session` and `Secure`; development HTTP mode is explicit and uses `kunai_session` without `Secure` only in development.
- `SafeSessionDto` exposes only `id`, `displayName`, `avatarKey`, and `onboardingCompleted`.
- Normal user-owned runtime operations use the authenticated user's PocketBase identity, not a superuser proxy.
- Browser JavaScript receives no PocketBase token, raw auth payload, private endpoint, or client SDK token storage.
- Invalid/expired credentials clear only the affected app cookie and resolve to anonymous/null session semantics.
- PocketBase outage returns unavailable/503, preserves a valid cookie for retry, and does not serve stale identity.
- Session/Home/onboarding/private responses use `Cache-Control: private, no-store`.
- Unsafe operations enforce configured same-origin/CSRF metadata before mutation.

Primary evidence:

- `auth-session-boundary-evidence.md`
- `docs/decisions/0009-nuxt-pocketbase-session-boundary.md`
- `tests/server/auth-session-boundary.test.ts`
- `tests/server/auth-routes-h3.test.ts`
- `tests/server/security.test.ts`
- `tests/ssr/security.test.ts`
- `tests/ssr/auth-routing*.test.ts`
- `manual-browser-validation-evidence.md`

Deployment note: real HTTPS/reverse-proxy validation was not available during Phase 0002. Production Secure-cookie/origin behavior is implemented and automated/configuration-tested, but the real deployment check remains deferred to Hardening/Release.

## Onboarding evidence summary

Verified behavior:

- MVP users are administratively provisioned; public registration is not provided.
- Onboarding collects/persists display name, approved avatar key, valid IANA timezone, and nullable/default location.
- Avatar registry contains the real owner-approved 10 bundled assets `avatar-01` through `avatar-10`; arbitrary upload is absent.
- Timezone manifest/generation parity is tested; no hidden UTC fallback is used.
- Location is optional; browser geolocation is requested only after explicit action and is non-blocking when denied, unavailable, timed out, or failed.
- No weather/geocoding/reverse-geocoding provider is called.
- Home seed creation is idempotent and creates exactly one `Home` dashboard plus exactly one each of `search`, `clock`, `weather`, and `bookmarks` seed placeholders.
- Completion is atomic/truthful through the final normal-user PocketBase batch and PocketBase completion guard.
- Retry/recovery handles partial durable state and unique conflicts without duplicate seed records.
- Seed corruption is detected and reported as `seed_conflict` rather than silently repaired.

Concurrency defect resolution:

- The historical onboarding concurrency flake was reproduced.
- Cause: during two concurrent real PocketBase completions, a losing request could observe a transient incomplete/incompatible seed while the winning request was completing, then throw `OnboardingCompletionError` `seed_conflict` 409 even though persisted final state was valid.
- Fix: `completeOnboarding` performs fresh persisted-state re-read and validates final completed state before returning success; if state remains incomplete but recoverable, only the bounded retry path is used.
- Real corrupt/incompatible completed seed still produces `seed_conflict`.
- Assertions were not relaxed; no silent repair, sleeps/open retries, extra dashboard, or extra widget was introduced.
- Post-fix validation: focal concurrent 10/10 PASS; repeated full `onboarding-concurrency` file 6/6 PASS; `onboarding-concurrency` 34/34 PASS; required PocketBase cohort PASS.

Primary evidence:

- `tests/integration/pocketbase/onboarding-seed.test.ts`
- `tests/integration/pocketbase/onboarding-concurrency.test.ts`
- `tests/integration/pocketbase/onboarding-batch-preflight.test.ts`
- `tests/server/onboarding-complete.test.ts`
- `tests/server/onboarding-routes.test.ts`
- `tests/onboarding.nuxt.test.ts`
- `tests/unit/onboarding-validation.test.ts`
- `tests/unit/avatar-registry.test.ts`
- `tests/unit/timezone-manifest-parity.test.ts`
- `checkpoint-4b-evidence.md`
- `final-automated-validation-evidence.md`

## Protected Home evidence summary

Verified behavior:

- `GET /api/home` returns a minimal DTO for the authenticated completed user's initialized Home.
- It enforces owner isolation and returns only the user's Home identity/state.
- It does not write, repair, reseed, render widgets, or expose dashboard editing.
- It emits private/no-store behavior.
- Real PocketBase 0.40.3 integration coverage exists in `tests/integration/pocketbase/home-route.test.ts`.

Manual validation defect and fix:

- Manual browser validation discovered that `login -> onboarding -> Home` displayed the user but `/api/home` returned `503 home_unavailable` because PocketBase 0.40.3 rejected the placeholder filter shape used by the route.
- The route filter was fixed to use the escaped literal owner filter.
- Regression coverage: `tests/integration/pocketbase/home-route.test.ts`.
- Revalidation: `login -> onboarding -> GET /api/home` returned 200 with `initialized: true` and `dashboard.name === "Home"`.

Primary evidence:

- `server/api/home.get.ts`
- `tests/server/home.test.ts`
- `tests/integration/pocketbase/home-route.test.ts`
- `tests/home.nuxt.test.ts`
- `tests/ssr/auth-routing.integration.nuxt.test.ts`
- `manual-browser-validation-evidence.md`

## Security evidence summary

Mapped security evidence:

- Two-user isolation: `tests/integration/pocketbase/schema-owner-isolation.test.ts`, `tests/integration/pocketbase/isolation/auth-onboarding.test.ts`, manual `15.1-TWO-USERS`.
- Owner isolation: PocketBase rules/hooks/migrations, schema-owner tests, Home route tests.
- Cross-request identity: `tests/server/auth-session-boundary.test.ts`, `tests/server/security.test.ts`, SSR routing tests.
- CSRF/same-origin: `server/utils/same-origin.ts`, auth route H3 tests, server security tests.
- Mass assignment: direct normal-token tests and server security tests.
- Session expiry: auth/session boundary tests and manual invalid-cookie validation.
- Outage: auth/session boundary tests and manual outage-cookie validation.
- Cookie behavior: session config tests, H3 route tests, manual DevTools cookie inspection.
- Token sentinel: server/security/SSR/client leakage tests and manual token/config exposure checks.
- SSR: auth-routing and security SSR tests.
- Client/browser leakage: manual browser evidence plus static/runtime config tests.
- Cache headers: server, SSR, Home, and session tests.

Security defect and fix:

- Task 14.1 discovered `GET /api/auth/session` did not emit required `Cache-Control: private, no-store` for valid, invalid, or PocketBase-outage responses.
- Task 14.2 corrected the defect by setting the header before session resolution.
- Regression coverage exists in the security/auth/session tests and the assertion is now passing.

No old informational advisories are treated as critical blockers in this packet.

## Manual validation evidence

Source: `openspec/changes/phase-0002-auth-onboarding/manual-browser-validation-evidence.md`.

Verified in the available local/dev HTTP + disposable PocketBase environment:

- login;
- session endpoint behavior;
- onboarding UI and completion;
- protected Home;
- logout;
- two isolated users;
- geolocation denied and unavailable paths;
- keyboard/focus basics;
- tablet/touch basics;
- reduced-motion behavior;
- token/config exposure checks;
- outage and invalid-cookie semantics;
- stale-tab equivalent behavior.

Deferred deployment check:

- Real HTTPS/reverse-proxy validation was not available.
- It remains explicitly deferred to Hardening/Release.
- It is not counted as a real PASS and was not simulated as one.
- Relevant requirements are marked `VERIFIED WITH DEFERRED DEPLOYMENT CHECK` where production deployment behavior depends on that environment.

## Final automated validation evidence

Source: `openspec/changes/phase-0002-auth-onboarding/final-automated-validation-evidence.md`.

Verified final environment:

- PocketBase runtime: `0.40.3`.
- JavaScript SDK: `pocketbase@0.28.1`.
- Disposable dataDir/processes: temporary directories with random loopback ports.
- Migrations and hooks applied through the disposable harness.
- Batch preflight covered by `tests/integration/pocketbase/onboarding-batch-preflight.test.ts`.

Final command results:

| Command | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 26 files / 242 tests |
| `pnpm build` | PASS |
| Explicit PocketBase integration command | PASS — 7 files / 69 tests |
| `git diff --check` | PASS |

Explicit PocketBase integration files:

- `tests/integration/pocketbase/compatibility.test.ts`
- `tests/integration/pocketbase/schema-owner-isolation.test.ts`
- `tests/integration/pocketbase/isolation/auth-onboarding.test.ts`
- `tests/integration/pocketbase/onboarding-seed.test.ts`
- `tests/integration/pocketbase/onboarding-concurrency.test.ts`
- `tests/integration/pocketbase/onboarding-batch-preflight.test.ts`
- `tests/integration/pocketbase/home-route.test.ts`

No required integration skips were observed.

Non-blocking warnings observed:

- Nuxt/Vitest message about `defineVitestConfig`/`defineVitestProject` in SSR-style tests.
- Vue/Nuxt `<Suspense>` experimental output.
- Build sourcemap warnings from `nuxt:module-preload-polyfill` and `@tailwindcss/vite:generate:build`.

## Migration, hooks, and rollback evidence

Implemented migration/hook surfaces:

- `pb_migrations/20260911180000_auth_onboarding.js`
- `pb_hooks/auth_onboarding.pb.js`
- `pb_hooks/lib/onboarding-validation.js`
- `pb_hooks/lib/avatar-manifest.js`

Verified evidence:

- PocketBase compatibility evidence validated the 0.40.3 runtime, JS migration syntax, auth collection modification, field types, access rules, indexes/partial uniqueness, hooks, native batch behavior, concurrent unique conflicts, and disposable migration reversal.
- Schema/owner isolation evidence validated the final migration shape and direct normal-user access rules.
- The destructive migration `down` path is guarded by `KUNAI_ALLOW_DESTRUCTIVE_MIGRATION_DOWN=1` and is documented for disposable rollback rehearsal only.
- Final automated validation re-ran the required disposable PocketBase integration suites, including compatibility and schema/owner isolation.

Rollback limitation:

- No destructive rollback was performed against production or valued data.
- Live rollback remains operator-controlled and requires backup/restore or forward-fix planning as documented by ADR 0008, ADR 0009, and operational docs.

## Review evidence summary

This packet summarizes review coverage without reproducing the full review log.

Critical Phase 0002 areas passed required review checkpoints:

| Area | Review evidence |
|---|---|
| PocketBase compatibility | Task/checkpoint recorded as reviewed/acknowledged in OpenSpec task evidence. |
| Schema + owner isolation | `schema-owner-isolation-evidence.md` records checkpoint result after review/acknowledgement. |
| Auth/session boundary | `auth-session-boundary-evidence.md` records checkpoint completion and review gate; subsequent tasks record reviewed/acknowledged state. |
| Onboarding persistence/Home seed/concurrency | Checkpoint 4A tasks recorded as reviewed/acknowledged; concurrency fix `review-f95b75a0b45dc694` approved/acknowledged. |
| Onboarding UI/avatar/location/timezone | `checkpoint-4b-evidence.md` plus task/review records. |
| Home protected route | Task 13.2 recorded with review before continuing. |
| Security/manual validation | Security/manual validation tasks recorded as reviewed/acknowledged before ADR/docs/final validation. |
| ADR | `review-a67b87976ea12105` approved/acknowledged for ADR 0009. |
| Operational docs | `review-292007caf1af70ef` approved/acknowledged. |
| Diagnostic/concurrency fix | Diagnostic review `review-a25ec053523460d1`; fix review `review-f95b75a0b45dc694`, approved/acknowledged. |
| Final automated validation / 18.1 | `review-e7bedd07ec259af4` approved/acknowledged. |

This document itself is the Task 18.2 verification packet and must receive its own native review before being considered closed.

## Known limitations

Real known limitations only:

- Real HTTPS/reverse-proxy validation remains pending for Hardening/Release or an owner-provided deployment environment.
- Logout is local/stateless: it clears the application cookie and request-local auth store, but does not globally revoke every PocketBase token.
- No global centralized session revocation/session registry exists in Phase 0002.
- Public registration, social login, password reset, and email verification user experiences/APIs are not implemented in Phase 0002.
- Phase 0003 dashboard functionality is not implemented yet: no dashboard tabs/lifecycle, grid editor, widget engine, Settings shell, providers, functional widgets, bookmark management, calendar, finance, travel, dev tools, AI features, collaboration, workspaces, organizations, or team roles.

## Blockers for `/sdd-verify`

No critical blockers are known for running `/sdd-verify` on Phase 0002.

Deferred deployment check:

- Real HTTPS/reverse-proxy validation remains deferred to Hardening/Release and is explicitly not claimed as a real PASS.

## Task 18.2 gate result

Task 18.2 is ready to be marked complete when this packet is saved, linked from `tasks.md`, and reviewed.

Phase 0002 remains active and unarchived. Task 17.2 remains pending until explicitly authorized after this task. Phase 0003 remains not started.
