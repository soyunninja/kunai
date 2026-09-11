# Checkpoint 1 Evidence — PocketBase compatibility validation

Change: `phase-0002-auth-onboarding`

Date: 2026-09-11

Scope: Validate the PocketBase 0.40.3 runtime and JavaScript SDK behavior required by the approved Phase 0002 design before implementing schema, auth/session, onboarding, or UI product functionality.

## Runtime and SDK

| Item | Observed result |
|---|---|
| PocketBase runtime | Downloaded `pocketbase_0.40.3_linux_amd64.zip` from the official GitHub release during the disposable test harness. |
| Archive SHA-256 | `8d81b6b79add0e219373e922ebe1dddbee7f57fcff602e3585e0d2c654b983ce` verified by the harness before execution. |
| Runtime version output | `pocketbase version 0.40.3`. |
| JavaScript SDK | `pocketbase@0.28.1` added as a dev dependency and validated against PocketBase `0.40.3`. |
| Disposable environment | Each test run creates a temporary directory outside the repo, downloads/extracts the binary there, starts PocketBase on a random loopback port, and removes the temp data after the test. |

## Capability matrix

| Capability | Design assumption | Test performed | Observed result | Status | Consequence for Phase 0002 |
|---|---|---|---|---|---|
| PocketBase runtime | Development/integration tests can run against exact PocketBase `0.40.3`. | Harness downloads official `0.40.3`, verifies SHA-256, runs `--version`, and starts the server from temp data. | Version matched exactly and server passed `/api/health`. | PASS | Use this harness pattern for later disposable integration tests. |
| JavaScript SDK compatibility | Official JS SDK can authenticate normal users and superusers against runtime `0.40.3`. | Installed `pocketbase@0.28.1`, authenticated `_superusers`, created two normal users, and authenticated both by email/password. | Superuser and normal-user auth succeeded. | PASS | `pocketbase@0.28.1` is the validated SDK candidate for Phase 0002. |
| AuthStore / request-scoped session seam | Nuxt can create a fresh SDK AuthStore per request and load a token/record into it. | Used `new BaseAuthStore()`, saved a normal user's token/record, constructed a new SDK client, and called `authRefresh()`. | Request-scoped client refreshed the expected user and `authStore.clear()` removed local state. | PASS | Design's request-scoped SDK/auth-store plan is viable. |
| Migrations syntax | `pb_migrations/*.js` uses JS `migrate((app)=>{}, (app)=>{})`. | Ran `pocketbase migrate create`, inspected the generated file, and ran custom `migrate up/down/up`. | Generated syntax matched and custom migrations applied/reversed/reapplied. | PASS | Proceed with JS migration source under `pb_migrations/`. |
| Auth collection fields | Existing `users` auth collection can be modified with profile fields. | Migration loaded existing `users`, added `displayName` and `onboardingCompleted`, and inspected collection metadata through SDK. | Fields existed on the auth collection after migration. | PASS | Phase 0002 can extend `users` rather than creating a duplicate auth collection. |
| Base collections, fields, relations | Migrations can create owner-scoped base collections with relation, text, bool, date, and JSON fields. | Migration created `compat_preferences`, `compat_dashboards`, and `compat_widgets` with owner/dashboard relations and JSON config. | Collections and fields were usable through normal API calls. | PASS | Proposed `user_preferences`, `dashboards`, and `dashboard_widgets` schema is viable. |
| Indexes / unique constraints | SQLite unique indexes, including partial seed indexes, can be added from migrations. | Migration added unique owner and partial seed indexes; concurrent duplicate creates were issued. | Exactly one concurrent create succeeded; the loser received a conflict/validation error; existing record was recoverable by owner+seed query. | PASS | Idempotent load-or-create can rely on durable database uniqueness plus reload-on-conflict. |
| Access rules list/view/create/update/delete | Owner-scoped rules using `@request.auth.id` can isolate normal users. | Two normal users created/listed/viewed/updated records and attempted cross-user access. | Own records were accessible; forged owner, cross-owner view, and owner reassignment were denied/hidden. | PASS | Owner-scoped PB rules remain a valid second authorization frontier. |
| Relation rule protection | Widget create/update can require the related dashboard to belong to the authenticated owner. | `compat_widgets` used rules with `dashboard.owner = @request.auth.id`; user A attempted to attach a widget to user B's dashboard. | Same-owner widget create succeeded; cross-owner dashboard relation was denied. | PASS | Phase 0002 can express dashboard-owner relation protection in rules for this tested shape. Hooks can remain an additional fallback if future syntax differs. |
| Hooks availability | Request hooks can validate and block invalid operations. | Added `onRecordUpdateRequest` hooks for `users` and `compat_preferences`; attempted blocked updates. | Hook-thrown errors rejected updates with 400 and preserved prior data. | PASS | PB hooks are viable for onboarding/profile guardrails. |
| Batch / atomicity / rollback | Multiple writes can be submitted atomically and roll back on partial failure. | Enabled batch config, submitted batches combining valid preference writes with invalid widget/user updates. | Failed batch left earlier writes unchanged; preference update rolled back when the later user hook rejected finalization. | PASS | Final onboarding snapshot + completion marker can use native batch semantics, subject to implementation-specific tests. |
| Concurrency | Unique conflicts are deterministic enough for idempotent recovery. | Sent two concurrent creates for the same `(owner, seedKey)` dashboard identity. | One request succeeded, one failed, and the successful record was recoverable by exact owner/seed lookup. | PASS | The planned retry/reload-on-unique-conflict algorithm is viable. |
| Disposable integration harness | Tests can run PocketBase safely outside repo data. | Harness used temp dirs, random loopback ports, setup-only superuser provisioning, normal user tokens for assertions, and cleanup in `afterAll`. | Test data stayed outside the repository and was cleaned up. | PASS | Later integration tests should reuse this harness style and must never target developer/production data. |
| Rollback / migration reversal | Migration down can reverse compatibility schema on disposable data. | Ran `migrate up`, `migrate down`, then `migrate up` before server assertions. | Commands succeeded. | PASS | Reversible migration behavior can be tested on disposable databases; live rollback remains operator-controlled per ADR 0008/design. |

## Evidence commands

```sh
pnpm vitest run tests/integration/pocketbase/compatibility.test.ts --reporter=verbose
pnpm typecheck
pnpm lint
pnpm test
```

Observed results:

- `tests/integration/pocketbase/compatibility.test.ts`: 4 tests passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 3 files passed, 26 tests passed.

## Gate result

Checkpoint 1 result: **PASS**.

No critical design contradiction was found. No product functionality, application login, session cookies, middleware, onboarding UI, Home seed implementation, schema finalization, or avatar integration was started.

## Notes for Checkpoint 2

- Use `pocketbase@0.28.1` as the validated SDK candidate unless a later implementation-specific issue appears.
- Keep the disposable harness isolated from repository `pb_data/` and from any configured developer/production PocketBase URL.
- Preserve the validated owner-rule + relation-rule approach, with hooks available for additional direct-API guardrails.
- Batch rollback was validated for the compatibility scenario; the full onboarding finalization guard still needs task-specific RED/GREEN tests before implementation is accepted.
