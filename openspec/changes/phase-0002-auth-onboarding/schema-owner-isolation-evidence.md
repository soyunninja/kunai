# Checkpoint 2 Evidence — Schema + owner isolation

Change: `phase-0002-auth-onboarding`

Date: 2026-09-11

Scope: Implement and verify the Phase 0002 PocketBase schema and direct normal-user owner isolation. This checkpoint does not implement Nuxt auth/session, cookies, login/logout routes, middleware, onboarding UI, geolocation, avatar UI, operational Home seed, or functional widgets.

## Migration artifacts

| Artifact | Purpose |
|---|---|
| `pb_migrations/20260911180000_auth_onboarding.js` | Extends the built-in `users` auth collection and creates `user_preferences`, `dashboards`, and `dashboard_widgets` with owner-scoped rules and durable uniqueness constraints. Its destructive `down` path is explicitly refused unless `KUNAI_ALLOW_DESTRUCTIVE_MIGRATION_DOWN=1` is set for disposable rollback rehearsal. |
| `tests/integration/pocketbase/support/harness.ts` | Shared disposable PocketBase 0.40.3 integration harness for real runtime tests. |
| `tests/integration/pocketbase/schema-owner-isolation.test.ts` | Direct PocketBase API matrix using normal User A/User B credentials for schema, rules, uniqueness, and relation defenses. |

## Resulting model

| Collection | Implemented fields / constraints |
|---|---|
| `users` auth collection | `displayName`, `avatarKey`, `timezone`, `onboardingCompleted`, `onboardingCompletedAt`; self view/update rule for normal credentials. |
| `user_preferences` | Required `owner` relation to `users`; `appearance` select with `dark`, `light`, `system`; nullable/unconfigured `defaultLocation` JSON; unique `owner` index. |
| `dashboards` | Required `owner`; required `name`; non-negative integer `sortOrder`; optional `seedKey`; partial unique `(owner, seedKey)` for nonempty seed keys; owner index. |
| `dashboard_widgets` | Required `owner`; required `dashboard`; required `type`; optional `seedKey`; required bounded `config`; nullable `layoutDesktop`, `layoutTablet`, `layoutMobile`; partial unique `(dashboard, seedKey)` for nonempty seed keys; owner/dashboard index. |

## Access rules implemented

| Collection | list/view | create | update | delete |
|---|---|---|---|---|
| `user_preferences` | `owner = @request.auth.id` | `owner = @request.auth.id` | stored owner matches and `@request.body.owner:isset = false` | `owner = @request.auth.id` |
| `dashboards` | `owner = @request.auth.id` | `owner = @request.auth.id` | stored owner matches and `@request.body.owner:isset = false` | `owner = @request.auth.id` |
| `dashboard_widgets` | `owner = @request.auth.id` | `owner = @request.auth.id && dashboard.owner = @request.auth.id` | stored owner matches, owner is not supplied, dashboard is not supplied, and stored `dashboard.owner = @request.auth.id` | `owner = @request.auth.id` |
| `users` | self only | admin provisioning only | self only | admin only |

Notes:

- Widget dashboard relations are immutable after create in this checkpoint. This is the minimal reliable direct-PocketBase defense for R3-unproved-relation-update: an already-valid widget cannot be updated to point at a cross-owner dashboard because `@request.body.dashboard:isset = false` rejects dashboard relation changes.
- Direct normal-user tests use superuser credentials only for administrative fixture setup.
- No Nuxt authorization layer is used to prove owner isolation.

## Capability matrix

| Capability | Test evidence | Status | Consequence |
|---|---|---|---|
| Reversible migration up/down/up | `schema-owner-isolation.test.ts` applies `up`, guarded `down`, `up` against disposable PB data before server assertions. | PASS | Migration can be rehearsed safely on disposable data only with explicit destructive rollback authorization. |
| Users auth profile fields | Collection metadata includes all Phase 0002 fields. | PASS | Built-in `users` extension is viable. |
| Preferences model | Metadata and unique-owner index verified; User A own CRUD succeeds; User B cannot access A. | PASS | One preferences record per owner is enforced. |
| Dashboards model | Metadata and partial Home seed index verified; User A own CRUD succeeds; User B cannot access A. | PASS | Exactly one seeded Home identity per owner can be enforced by durable uniqueness. |
| Dashboard widgets model | Metadata and partial widget seed index verified; own CRUD succeeds; cross-user access fails. | PASS | Seeded widget placeholders can be uniquely identified per dashboard. |
| Forged owner create | User A create with User B owner is rejected. | PASS | Client-supplied owner does not grant authorization. |
| Forged owner update / reassignment | User A update attempting owner reassignment is rejected and persisted owner remains unchanged. | PASS | Owner cannot be reassigned by normal API input. |
| Cross-owner dashboard relation create | User A cannot create a widget pointing at User B's dashboard. | PASS | Relation create is protected by `dashboard.owner = @request.auth.id`. |
| Cross-owner dashboard relation update | User A cannot update an existing widget's dashboard to User B's dashboard; reloaded widget retains original dashboard. | PASS | R3-unproved-relation-update is covered by making dashboard relation immutable in direct normal-user updates. |
| Unique preferences per owner | Second preferences create for same owner is rejected. | PASS | Durable one-record-per-owner invariant exists. |
| Unique Home seed per owner | Duplicate `(owner, seedKey)` dashboard is rejected; another owner may use same seed. | PASS | Home seed identity is per owner, not global. |
| Unique widget seed per dashboard | Duplicate `(dashboard, seedKey)` widget is rejected. | PASS | Seeded widget identity is per dashboard. |
| Order-independent harness | New schema isolation tests provision fresh User A/User B per test; compatibility batch test no longer depends on dashboard fixtures created by a prior test. | PASS | R3-order-dependent-tests addressed minimally without broad refactor. |

## Evidence commands

```sh
pnpm vitest run tests/integration/pocketbase/compatibility.test.ts tests/integration/pocketbase/schema-owner-isolation.test.ts --reporter=verbose
```

Observed result: 2 files passed, 12 tests passed.

## Finding disposition

| Finding | Disposition |
|---|---|
| `R3-order-dependent-tests` | Addressed. The compatibility batch rollback test now creates isolated dashboards inside the test instead of relying on state from another test. New Checkpoint 2 tests provision unique normal users per test. |
| `R3-external-download-test` | Accepted for now. The harness still validates exact PocketBase `0.40.3`, verifies SHA-256 `8d81b6b79add0e219373e922ebe1dddbee7f57fcff602e3585e0d2c654b983ce`, raises explicit download failure, and documents the external dependency in Checkpoint 1 evidence. No offline infrastructure was added. |
| `R3-unproved-relation-update` | Addressed for Checkpoint 2. A direct normal-user test proves User A cannot update a widget relation to User B's dashboard and that the original relation remains unchanged. |

## Gate result

Checkpoint 2 result after review/acknowledgement: **PASS**.

No critical contradiction was found in PocketBase 0.40.3 for the implemented schema/rules. No product login, session cookie, Nuxt middleware, onboarding UI, geolocation, avatar UI, Home seed operation, or Checkpoint 3 work was started.
