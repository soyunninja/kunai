# Explore — Phase 0003 Dashboard Tabs & Shell

## Intent

Explore the verified Phase 0002 application state and define the planning baseline for `phase-0003-dashboard-shell` before proposal, spec, design, tasks, or implementation.

This artifact is planning-only. It does not implement application code, tests, migrations, commits, pushes, Phase 0004 grid work, or widget functionality.

## Inputs reviewed

- `AGENTS.md`
- `project/context.md`
- `project/phase-map.md`
- `project/rules.md`
- `project/product-decisions.md`
- `project/open-decisions.md`
- `docs/product/vision.md`
- `docs/product/mvp.md`
- `docs/architecture/overview.md`
- `docs/architecture/data-model.md`
- `docs/phases/0003-dashboard-tabs.md`
- `docs/decisions/0002-user-isolation.md`
- `docs/decisions/0003-dashboard-model.md`
- `docs/decisions/0009-nuxt-pocketbase-session-boundary.md`
- `openspec/specs/application-foundation/spec.md`
- `openspec/specs/pocketbase-foundation/spec.md`
- `openspec/specs/visual-foundation/spec.md`
- Phase 0002 archive: `openspec/changes/archive/2026-09-14-phase-0002-auth-onboarding/`

A read-only scout also mapped current implementation and test surfaces.

## Canonical change name

The canonical Phase 0003 change name is `phase-0003-dashboard-shell`. The planning package remains at:

`openspec/changes/phase-0003-dashboard-shell/`

The current branch `feat/phase-0003-dashboard-shell` matches the canonical change name. Any older phase-brief wording that used a tabs-only slug is superseded for this change.

## Current implementation baseline

### Auth and session boundary

Phase 0002 established the server-owned authentication boundary:

- `server/utils/session.ts` resolves the HttpOnly cookie through PocketBase `users.authRefresh()` and projects only `SafeSessionDto`.
- `app/composables/useSession.ts` exposes browser-safe session state and login/logout/refresh operations.
- `server/utils/pocketbase-client.ts` creates request-scoped PocketBase SDK clients with fresh auth stores.
- `server/utils/same-origin.ts` protects unsafe mutations.
- private responses use `Cache-Control: private, no-store`.
- browser JavaScript does not receive the PocketBase token or a direct PocketBase SDK path.

Phase 0003 must keep all dashboard reads/writes behind the same Nuxt server boundary and normal-user PocketBase identity.

### Current routes and shell

- `app/utils/auth-routing.ts` currently models only `/`, `/login`, and `/onboarding`.
- `app/pages/index.vue` is a minimal protected Home confirmation with logout.
- `server/api/home.get.ts` returns only the Phase 0002 Home DTO and validates the seed very strictly:
  - owner must match;
  - `seedKey` must be `home`;
  - `name` must be `Home`;
  - `sortOrder` must be `0`.

Phase 0003 must replace or generalize this minimal landing contract. If Home becomes reorderable or renameable, the strict Phase 0002 Home endpoint cannot remain the sole dashboard authority.

### Current persistence

The Phase 0002 migration already created:

- `dashboards`: `owner`, `name`, `sortOrder`, `seedKey`, `created`, `updated`;
- `dashboard_widgets`: `owner`, `dashboard`, `type`, `seedKey`, `config`, `layoutDesktop`, `layoutTablet`, `layoutMobile`, `created`, `updated`;
- owner-scoped rules for normal users;
- a partial unique index for non-empty `(owner, seedKey)` on dashboards;
- a partial unique index for non-empty `(dashboard, seedKey)` on widgets.

Onboarding creates exactly one Home dashboard with `seedKey: home`, `name: Home`, and `sortOrder: 0`, plus four seed widget placeholders. Phase 0003 must reuse that Home record and must not duplicate it.

### UI baseline

The current application has a dark-first, terminal-inspired baseline and local UI primitives:

- `app/components/ui/button/Button.vue`
- `app/components/ui/input/Input.vue`
- `app/components/ui/label/Label.vue`
- `app/components/ui/alert/Alert.vue`

No tabs, dropdown, dialog, sortable, or settings-navigation primitive exists yet. Phase 0003 can add local shadcn-vue-style primitives only where they serve the shell; it must not introduce another UI framework.

### Test baseline

Relevant existing tests include:

- `tests/server/home.test.ts`
- `tests/integration/pocketbase/home-route.test.ts`
- `tests/home.nuxt.test.ts`
- `tests/ssr/auth-routing*.test.ts`
- `tests/ssr/security.test.ts`
- `tests/server/security.test.ts`
- PocketBase disposable integration harness under `tests/integration/pocketbase/support/`

Several Phase 0002 Home tests deliberately assert that dashboard tabs, settings, edit controls, and widgets are absent. Phase 0003 should replace those phase-boundary assertions with positive shell behavior tests instead of treating them as permanent constraints.

## Product and architecture facts to preserve

- Dashboards are generic user-owned records, not hard-coded Home/Travel/Dev routes.
- New users start with exactly one Home dashboard.
- Travel and Dev are not auto-created.
- Each user's dashboards remain private and independent.
- No workspaces, team roles, shared dashboards, or collaboration model exists in the MVP.
- Phase 0003 prepares a shell for Phase 0004 but does not implement the grid engine.
- No widget rendering, widget layout, drag/drop, resize, providers, or functional widgets belong in this phase.

## Approved decisions

### Home rename/delete policy

The owner approved the Phase 0003 policy:

- seeded Home (`seedKey: home`) is **renameable** so dashboards are generic user-facing tabs;
- seeded Home is **not archivable/deletable** during Phase 0003;
- this Home restriction is specific to Phase 0003 and may be reconsidered in a later phase;
- no dashboard removal uses hard delete;
- the system also prevents archiving/removing the last non-archived dashboard regardless of seed key.

This preserves the Home seed as a durable recovery anchor while allowing the tab label to be user-controlled.

### Removal behavior

Hard delete is risky because Phase 0002 created dependent `dashboard_widgets` records and relation deletion behavior was not designed for dashboard lifecycle. Recommended planning position:

- Phase 0003 adds soft removal with `dashboards.archivedAt`;
- list and active-dashboard APIs exclude archived dashboards;
- archived dashboards are not restored through UI in Phase 0003 unless explicitly specified later;
- seeded Home cannot be archived in this phase.

### Active dashboard persistence

Recommended planning position:

- support URL selection through `?dashboard=<id>` on `/` for refresh/share-with-self stability without product-specific routes;
- persist last active dashboard per user in `user_preferences.activeDashboard` only through an explicit same-origin mutation;
- keep `GET` dashboard reads free of business writes;
- fall back to first non-archived dashboard by `sortOrder`, then seeded Home if needed;
- never create a dashboard merely because a requested active id is invalid.

## Gaps for Phase 0003

- General dashboard list/read DTOs do not exist.
- Dashboard mutations do not exist: create, rename, reorder, archive/remove.
- Active-dashboard persistence does not exist.
- Current Home endpoint rejects rename/reorder.
- Auth routing does not explicitly model settings/shell routes.
- UI has no dashboard tabs, create action, settings entry, edit entry, or empty dashboard state.
- Concurrency semantics for reorder/create/archive are not specified yet.

## Planning risks

| Risk | Planning treatment |
|---|---|
| Canonical-name drift | Use `phase-0003-dashboard-shell` everywhere in this planning package; update later project truth during sync/archive if needed. |
| Home policy regression | Treat approved Phase 0003 Home rename/no-archive/no-hard-delete policy as an implementation invariant. |
| Soft delete requires migration/hook/rule changes | Plan RED integration tests before schema change. |
| Reorder races can create duplicate/unstable order | Use one explicit reorder endpoint with whole-list validation and deterministic normalization. |
| Phase 0002 Home tests assert absence of Phase 0003 UI | Replace with Phase 0003 positive shell tests during apply. |
| Review size likely exceeds 400 lines | Split implementation into small checkpoints and request review at each checkpoint. |

## Conclusion

The repository is ready for Phase 0003 planning. Phase 0003 should extend the existing authenticated Home into a generic dashboard shell with owner-scoped dashboard lifecycle APIs, soft removal, active dashboard state, and accessible tab UI while leaving the widget grid engine for Phase 0004.
