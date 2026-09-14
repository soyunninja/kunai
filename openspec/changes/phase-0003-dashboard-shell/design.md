# Design — Phase 0003 Dashboard Tabs & Shell

## Decision and scope

Phase 0003 introduces a real authenticated dashboard shell and dashboard-tab lifecycle while preserving the Phase 0002 server-owned auth boundary. Dashboards remain generic owner-scoped PocketBase records. The shell can host the future grid, but this phase renders only safe empty/placeholder dashboard bodies.

This is a design artifact. It does not implement code, tests, migrations, commits, pushes, or Phase 0004 widget-grid work.

## Source reconciliation

- Product docs require dashboard tabs, create, switch, rename, reorder, remove according to Home policy, edit/settings entry points, and a compact terminal-inspired shell.
- Phase 0002 already created owner-scoped `dashboards` and `dashboard_widgets`, a seeded Home dashboard, safe session state, request-scoped PocketBase clients, and protected minimal Home.
- The owner resolved Home behavior for Phase 0003: Home can be renamed, cannot be archived/deleted during this phase, the restriction may be reconsidered later, and hard delete is out of scope.
- The canonical change name is `phase-0003-dashboard-shell`; this design uses that path and treats the product slice as Dashboard Tabs & Shell.

## Approved product decisions

### Home policy

Phase 0003 allows seeded Home to be renamed but not archived/deleted.

Rationale:

- Home is a user-facing tab, so the visible label can be user-controlled.
- `seedKey: home` remains a durable internal identity for onboarding/recovery compatibility.
- Deleting Home would remove the only guaranteed dashboard anchor and its Phase 0002 seed widgets.
- Preventing Home archive keeps zero-dashboard and orphan-seed risks small until a future settings/recovery policy exists.
- This restriction is explicitly Phase 0003-specific and can be reconsidered by a later approved phase.

### Removal policy

Phase 0003 implements soft removal with `archivedAt` on `dashboards`, not hard delete.

Rationale:

- Phase 0002 widget records depend on dashboards.
- Relation cascade/delete behavior was not designed as part of onboarding.
- Soft archive is safer, reversible by future work, and avoids accidental widget data loss.
- The shell can simply exclude archived dashboards.

### Active dashboard persistence

Phase 0003 should persist the last active dashboard in `user_preferences.activeDashboard` as an optional relation or bounded text id validated against the current owner. Persistence must happen only through an explicit same-origin mutation; `GET` dashboard reads must not perform business writes.

Rationale:

- URL-only state is not enough for a startup page that should remember the user's current tab.
- Client-only local storage would bypass the server-owned/private-state model.
- Persistence in preferences keeps active selection owner-scoped and server-validated.
- Keeping reads side-effect-free preserves the Phase 0002 boundary that GET endpoints do not perform business writes.

## Persistence design

### Existing collections

`dashboards` already has:

- `owner`
- `name`
- `sortOrder`
- `seedKey`
- `created`
- `updated`

`dashboard_widgets` already has owner-scoped widget placeholder records and nullable layouts. Phase 0003 does not change widget rendering or layout semantics.

### Proposed migration additions

Add to `dashboards`:

- `archivedAt`: optional date, null/empty when visible in the shell.

Add to `user_preferences`:

- `activeDashboard`: optional single relation to `dashboards` if PocketBase rule/hook validation can enforce ownership reliably; otherwise use a nullable text id with server/hook validation.

Recommended final choice: relation field, provided PocketBase 0.40.3 direct normal-user rule/hook tests confirm resulting relation ownership checks. If relation validation is insufficient, use text plus hook validation. The security invariant matters more than the storage type.

### Rules and hooks

PocketBase rules/hooks must preserve direct normal-user isolation, not just Nuxt UI behavior.

Required invariants:

- dashboard owner cannot be forged or reassigned;
- seed identity cannot be changed by normal users;
- archived dashboards remain owner-scoped;
- seeded Home cannot be archived in Phase 0003;
- archiving the last non-archived dashboard is rejected;
- active dashboard preference, if set, must reference an owned, non-archived dashboard;
- reorder cannot be performed by arbitrary direct field edits that create invalid owner/seed/archive state.

Nuxt remains the main lifecycle boundary; hooks/rules are defense in depth for direct normal PocketBase requests.

## DTOs and HTTP contracts

All private dashboard endpoints return `Cache-Control: private, no-store`. Unsafe endpoints validate same-origin before body parsing/mutation. All operations resolve the session and use the request-scoped PocketBase client authenticated as the normal user.

### Shared DTOs

```ts
interface DashboardTabDto {
  id: string
  name: string
  sortOrder: number
  seedKey: 'home' | string | null
  isHome: boolean
  canRename: boolean
  canArchive: boolean
}

interface DashboardShellDto {
  dashboards: DashboardTabDto[]
  activeDashboardId: string
  activeDashboard: DashboardTabDto
}
```

The browser does not receive widget records, raw PocketBase records, owner ids, rule diagnostics, archived dashboards, or token data.

### `GET /api/dashboards`

Purpose: list non-archived dashboards and resolve active dashboard.

Query:

- optional `dashboard=<id>` active selection candidate.

Behavior:

1. Resolve authenticated completed session.
2. Load current user's non-archived dashboards ordered by `sortOrder`, then `created`, then `id` as deterministic tie-breaker.
3. If no non-archived dashboards exist, return a safe conflict because this violates invariants; do not silently create one.
4. Select active dashboard by valid query id, valid persisted preference, or first sorted dashboard.
5. Return `DashboardShellDto` without writing preferences or other business state.

Errors:

- `401 unauthenticated`
- `409 onboarding_required`
- `409 dashboards_unavailable` or `dashboard_state_inconsistent`
- `503 dashboards_unavailable`

### `POST /api/dashboards/active`

Purpose: persist the user's active dashboard explicitly.

Input:

```ts
{ dashboardId: string }
```

Behavior:

- same-origin first;
- validate completed session;
- load the dashboard as owned and non-archived;
- persist it as the user's active dashboard preference;
- return updated `DashboardShellDto`.

This endpoint owns active preference writes. `GET /api/dashboards` must not persist merely because a query parameter was valid.

### `POST /api/dashboards`

Purpose: create a new empty dashboard.

Input:

```ts
{ name: string }
```

Behavior:

- same-origin first;
- validate completed session;
- trim and validate name;
- derive owner from session;
- compute next `sortOrder` after current non-archived dashboards;
- create with empty `seedKey` and no archived date;
- optionally set active dashboard to the created id;
- return updated `DashboardShellDto` or created tab DTO plus active id.

Reject unknown or unauthorized fields; do not seed widgets, layouts, Travel, or Dev.

### `PATCH /api/dashboards/:id`

Purpose: rename one owned non-archived dashboard.

Input:

```ts
{ name: string }
```

Behavior:

- same-origin first;
- validate completed session;
- load owned dashboard;
- reject archived dashboard;
- validate name;
- update only `name`;
- preserve `owner`, `seedKey`, `sortOrder`, `archivedAt`, and widgets;
- return tab DTO or shell DTO.

Seeded Home may be renamed under the approved Phase 0003 policy, but `seedKey` remains `home`.

### `POST /api/dashboards/reorder`

Purpose: persist full tab order.

Input:

```ts
{ dashboardIds: string[] }
```

Behavior:

- same-origin first;
- validate completed session;
- load all current owned non-archived dashboards;
- require the submitted ids to exactly equal that set, with no missing, extra, duplicate, archived, or cross-owner ids;
- update `sortOrder` to zero-based or one-based normalized integers consistently;
- return updated shell DTO.

Use a deterministic batch/update sequence. If a concurrent archive/create changes the set between read and write, fail with `409 dashboard_order_conflict` and ask the client to refresh.

### `POST /api/dashboards/:id/archive`

Purpose: soft-remove an allowed dashboard.

Input:

```ts
{}
```

Behavior:

- same-origin first;
- validate completed session;
- load owned dashboard;
- reject if `seedKey === 'home'` under Phase 0003 policy;
- reject if it is the last non-archived dashboard;
- set `archivedAt` to server time;
- if it was active, select and persist the first remaining dashboard;
- return updated shell DTO.

No widget records are deleted.

### Optional settings route

If implemented, `/settings` is protected by the same auth routing and renders only a minimal shell/navigation placeholder. It must not implement full settings sections or provider credential management.

## Server architecture

Introduce a narrow dashboard service, for example `server/utils/dashboards.ts`, with pure helpers where possible:

- parse dashboard name;
- project tab DTOs;
- classify PocketBase errors;
- load non-archived dashboards;
- resolve active dashboard;
- normalize reorder payload;
- enforce removal policy;
- update active preference.

Routes remain thin H3 handlers that perform same-origin/session/error plumbing and call this service.

Do not create a generic PocketBase proxy. Do not use superuser runtime authority for normal dashboard lifecycle.

## Client architecture

Introduce `app/composables/useDashboards.ts`:

- SSR-friendly initial shell state;
- load shell data with optional active id;
- select dashboard by updating URL/query and server preference;
- active selection persistence through the explicit Nuxt mutation;
- create, rename, reorder, archive actions through Nuxt APIs;
- loading/error/retry state;
- stale-response suppression similar to `useSession` where needed.

Components should remain small:

- `DashboardShell.vue`
- `DashboardHeader.vue`
- `DashboardTabs.vue`
- `DashboardEmptyState.vue`
- small local primitives for tabs/menu/dialog only if needed.

Use local shadcn-vue-style primitives when useful, but do not introduce another UI framework. If a primitive is added, keep it accessible and minimal.

## SSR and routing

Root `/` remains the dashboard shell for completed users. It accepts optional `?dashboard=<id>`. This avoids hard-coded dashboard-specific routes and avoids slugs before the product needs them.

SSR should:

- resolve session on the original event;
- load dashboard shell data before rendering protected content;
- set private/no-store headers;
- render loading/unavailable states without exposing stale data;
- keep hydration DTOs consistent with client state.

`app/utils/auth-routing.ts` must be extended intentionally if `/settings` or other protected shell routes are added. Unknown routes should not accidentally render protected shell content without authorization.

## UX design

### Header

Header structure:

- product/identity text mark;
- horizontal dashboard tabs;
- `+` create action;
- edit-current-dashboard entry point;
- settings entry point;
- user/avatar cluster;
- logout;
- appearance control if layout supports it.

Desktop/tablet should use horizontal tabs. Mobile may use horizontally scrollable tabs or a compact overflow pattern, but must remain operable without hover.

### Dashboard body

The active dashboard body renders a placeholder such as:

- dashboard name;
- status that the dashboard is ready;
- message that widgets/grid arrive in later phases;
- optional edit placeholder disabled until Phase 0004.

No Phase 0002 seed widgets are rendered functionally.

### Forms and interactions

Create/rename interactions should be keyboard-friendly, field-level validated, and recoverable. A simple inline form or minimal dialog is acceptable. Reorder can initially be implemented with accessible move-left/move-right controls rather than drag/drop; drag/drop belongs with later edit/grid work unless a small accessible reorder primitive is justified.

## Accessibility

- Tabs use appropriate tab/list semantics or a documented accessible navigation pattern.
- Active tab is conveyed by text/aria and non-color styling.
- Focus order follows visual order.
- Create/rename/archive controls are reachable by keyboard.
- Destructive archive action requires a clear confirmation or reversible/low-risk affordance.
- Touch targets meet the existing tablet-friendly baseline.
- Reduced-motion preferences are respected.

## Concurrency and idempotence

- Create is not idempotent by default because each valid request creates a new dashboard. UI should disable duplicate local submits, but server correctness must not rely on it.
- Rename is last-write-wins for the same dashboard unless validation fails.
- Reorder requires the complete current non-archived id set; stale reorder payloads fail with conflict.
- Archive rejects stale requests that target already archived, Home, missing, cross-owner, or last dashboard.
- Active preference updates validate the target at the time of the explicit write; invalid persisted preferences are ignored during reads and replaced only by later valid explicit selection or lifecycle fallback mutation.

## Security

Phase 0003 must preserve Phase 0002 guarantees:

- GET routes do not perform business writes;
- no browser PocketBase token;
- no direct browser PocketBase SDK;
- request-scoped SDK client only;
- normal-user identity for owner CRUD;
- same-origin for mutations;
- minimal DTOs;
- no-store private responses;
- sanitized errors and logs;
- no superuser runtime fallback.

Additional dashboard-specific threats and controls:

| Threat | Control |
|---|---|
| Cross-user dashboard access | Nuxt owner filters plus PocketBase owner rules/hooks and direct normal-token tests. |
| Forged owner/seed/archive fields | Server allowlist and PB hooks reject protected field mutation. |
| Cross-origin create/rename/reorder/archive | Same-origin validation before body processing/mutation. |
| Zero-dashboard state | Server service and PB hook reject last-dashboard archive. |
| Seed Home loss | Service and PB hook reject Home archive for Phase 0003. |
| Stale reorder corruption | Full-set validation and conflict response. |
| Token/endpoint leakage | Sentinel/static/browser checks as in Phase 0002 security tests. |

## Testing strategy

Use strict TDD during apply.

### Unit tests

- dashboard name parser;
- DTO projection;
- active selection resolver;
- reorder payload validation;
- archive policy;
- field allowlist/unknown input rejection.

### Server route tests

- `GET /api/dashboards` auth states, active id handling, no-store, DTO shape, and absence of write side effects;
- explicit active selection, create/rename/reorder/archive success and validation failures;
- same-origin rejection before mutation;
- invalid/session outage semantics;
- sanitized error payloads.

### PocketBase integration tests

- migration fields and reversible disposable behavior;
- owner isolation for dashboard lifecycle fields;
- direct normal-user attempts to mutate owner, seed, archive Home, archive last dashboard, and cross-owner active preference;
- reorder/soft archive under real PocketBase 0.40.3 semantics.

### SSR/Nuxt/UI tests

- completed user SSR shell with tabs and active dashboard;
- anonymous/incomplete redirects preserved;
- invalid query id fallback;
- loading/error/empty states;
- tab keyboard behavior;
- create/rename/archive form behavior;
- responsive header basics;
- absence of widget grid/functional widgets/Travel/Dev auto-creation.

### Security tests

- token/private endpoint sentinel checks in SSR HTML, Nuxt payload, JSON, browser storage, and public runtime config;
- cross-request identity isolation;
- CSRF variants for every dashboard mutation;
- two-user isolation across server and direct PB tests.

### Manual checks

- desktop tab navigation;
- tablet touch targets;
- mobile usable overflow;
- keyboard-only tab switching and forms;
- visual style against terminal-inspired baseline;
- logout/session invalidation from shell;
- empty dashboard placeholder and absence of Phase 0004 grid behavior.

## Review workload forecast

Phase 0003 likely exceeds a single 400-line review budget if implemented as one change. Recommended checkpoints:

1. schema/rules and server DTO contracts;
2. dashboard APIs and active selection;
3. shell UI and SSR routing;
4. lifecycle interactions/accessibility/security finalization.

Each checkpoint should receive focused review before continuing.

## Rollout and rollback

Apply migrations only after disposable PocketBase tests pass. Soft archive minimizes destructive risk. Do not run destructive rollback against valued data without explicit operator approval and backup/restore plan. If dashboard shell rollout fails, hide or disable new shell routes rather than weakening owner rules or session boundaries.

## Handoff to tasks

Tasks should be split into RED/GREEN/REFACTOR checkpoints and stop before apply until the owner separately authorizes implementation. The approved delivery approach is checkpoint-sized implementation and independent review per relevant checkpoint, with no global review authorization for the full session and no monolithic 1,600–2,400 line change. Remaining apply inputs are:

- active-dashboard persistence shape validation against PocketBase behavior;
- soft archive migration details;
- checkpoint-by-checkpoint review routing.
