# Proposal — Phase 0003 Dashboard Tabs & Shell

## Intent

Build the authenticated dashboard shell and dashboard-tab lifecycle for the personal command center. Phase 0003 turns the Phase 0002 protected Home landing into a real dashboard navigation surface while deliberately stopping before the widget grid engine.

The change reuses the existing Phase 0002 Home seed and owner-scoped PocketBase model. It introduces list/select/create/rename/reorder/remove behavior for dashboards, a persistent active dashboard, and a desktop-first terminal-inspired shell that can host the future Phase 0004 grid.

This proposal is planning-only. It does not implement code, tests, migrations, commits, pushes, or Phase 0004 work.

## Scope / What changes

### 1. Authenticated dashboard shell

- Replace the minimal protected Home confirmation with a real authenticated dashboard shell.
- Render product identity, dashboard tabs, `+` create action, current user/avatar affordance, logout, and the existing appearance control where it fits.
- Keep the visual direction dark-first, terminal-inspired, mostly monospaced, compact, and restrained.
- Keep desktop first-class, tablet touch-friendly, and mobile usable.
- Provide a safe empty/placeholder dashboard body only; no grid or widget rendering.

### 2. Dashboard list and active selection

- List only the current user's non-archived dashboards through Nuxt server routes using the authenticated normal user's PocketBase identity.
- Preserve `sortOrder` and render dashboard tabs in that order.
- Resolve an active dashboard deterministically from:
  1. valid `?dashboard=<id>` URL selection;
  2. persisted user preference when valid;
  3. first non-archived dashboard by order;
  4. seeded Home fallback.
- Persist the user's active dashboard only through an explicit same-origin mutation, never as a side effect of `GET`.
- Maintain coherent SSR and refresh behavior without exposing PocketBase tokens.

### 3. Dashboard lifecycle

- Create a new empty dashboard via the `+` action.
- Rename dashboards with validation and recoverable errors.
- Reorder tabs and persist the resulting order.
- Remove dashboards according to the resolved policy below.
- Prevent any state in which a user has zero non-archived dashboards.
- Reuse the existing Phase 0002 Home record; never create a duplicate Home during Phase 0003.

### 4. Removal and Home policy

Approved policy for Phase 0003:

- seeded Home (`seedKey: home`) may be renamed;
- seeded Home may not be archived/deleted during Phase 0003;
- this Home restriction is specific to Phase 0003 and may be reconsidered in a later phase;
- no dashboard can be archived when it is the user's last non-archived dashboard;
- removal is implemented as soft archive (`archivedAt`) rather than hard delete;
- hard delete is not used in Phase 0003.

Rationale: Phase 0002 seeded widgets depend on Home, and hard deletion of dashboards with dependent widget records was not designed. Soft archive protects data safety and leaves room for future restore/settings behavior without introducing it now.

This policy has owner approval for Phase 0003.

### 5. Settings and edit entry points

- Provide entry points for future Settings and current-dashboard edit mode.
- A minimal settings shell/navigation may exist only as a terminal-inspired placeholder if needed to satisfy the phase brief.
- Do not implement full Settings sections or grid edit mode.
- The edit entry may be present but disabled/placeholder until Phase 0004 defines grid editing.

## Non-goals

Phase 0003 MUST NOT implement:

- 8-column grid engine;
- drag/drop;
- resize;
- widget positioning;
- widget rendering;
- functional Search, Clock, Weather, Bookmarks, Scratchpad, Finance, Calendar, Travel widgets, Dev tools, or AI;
- automatic Travel or Dev dashboard creation;
- dashboard sharing, teams, organizations, roles, or collaboration;
- direct browser PocketBase SDK usage;
- provider integrations;
- full settings implementation;
- public registration or session architecture changes;
- commits, pushes, or pull requests as part of planning.

## Affected areas

| Area | Expected impact |
|---|---|
| `pb_migrations/` | Add optional dashboard lifecycle fields and active-dashboard preference storage if design confirms the migration shape. |
| `pb_hooks/` | Preserve owner/seed invariants; enforce Home/archive/last-dashboard rules where direct normal PocketBase API access could bypass Nuxt. |
| `server/api/dashboards/` | New bounded dashboard list, create, update/rename, reorder, archive, and active-selection routes. |
| `server/utils/` | Dashboard service, DTO projection, order normalization, sanitized errors, shared validation. |
| `shared/` | Dashboard DTO and validation types. |
| `app/pages/index.vue` | Authenticated dashboard shell replacing minimal Home confirmation. |
| `app/components/` | Dashboard tabs/header/shell components and local UI primitives as needed. |
| `app/composables/` | Dashboard state/actions through Nuxt API only. |
| `app/utils/auth-routing.ts` | Explicitly model the protected shell and any minimal settings route. |
| `tests/` | RED/GREEN coverage for server routes, PocketBase rules/hooks, SSR, UI, accessibility, concurrency, and security. |
| docs/OpenSpec | Track implementation evidence later; do not update verified project context until verification/sync/archive. |

## Security and privacy constraints

Phase 0003 must keep Phase 0002's security boundary:

- server-owned HttpOnly session cookie;
- `SafeSessionDto` only in browser-visible auth state;
- request-scoped PocketBase SDK clients;
- normal-user PocketBase identity for owner-owned operations;
- Nuxt app-layer owner checks plus PocketBase owner rules;
- same-origin validation before unsafe mutations;
- `Cache-Control: private, no-store` for private dashboard responses;
- sanitized error DTOs;
- no PocketBase bearer token, private endpoint, superuser credential, or direct browser SDK path.

## Success criteria

1. A completed user lands on a real dashboard shell rather than the Phase 0002 Home confirmation.
2. Only that user's non-archived dashboards appear as tabs.
3. The existing Home seed is reused and not duplicated.
4. Dashboard tab order persists and survives SSR refresh.
5. A valid active dashboard is resolved consistently across SSR, client navigation, refresh, and invalid URL ids.
6. Users can create, rename, reorder, and archive allowed dashboards through bounded API operations.
7. The system prevents zero-dashboard state and protects seeded Home according to the approved policy.
8. Dashboard mutations preserve owner isolation through both Nuxt and direct normal PocketBase access rules/hooks.
9. The shell is keyboard-operable, touch-usable, dark-first, terminal-inspired, and responsive enough for desktop/tablet/mobile.
10. Empty dashboards show a safe placeholder and no widget grid/functionality.
11. Tests and manual checks verify SSR, loading/error/empty states, access control, concurrency, and phase boundaries.

## Risks and approval gates

| Risk / decision | Required treatment |
|---|---|
| Home policy regression | Preserve approved Phase 0003 policy: Home can be renamed, cannot be archived/deleted, no hard delete, and zero-dashboard state is forbidden. |
| Canonical-name drift | Use `phase-0003-dashboard-shell` as the canonical change name. |
| Soft archive migration affects existing data model | Use RED tests against disposable PocketBase before migration/hook changes. |
| Active dashboard persistence may require schema change | Specify and test migration; do not use hidden client storage as the source of truth. |
| Reorder races and stale tabs | Use full-order payload validation, owner-scoped IDs, deterministic normalization, and concurrency tests. |
| Review workload likely exceeds 400 lines | Split into checkpoints and request native review at risk boundaries. |

## Rollback

Planning artifacts can be revised or removed before apply without runtime effects.

For later implementation, migration rollback must follow the repository's PocketBase migration rules and never destructively remove valued user dashboard/widget records without an operator-approved backup/restore or forward-fix plan. Soft archive reduces deletion risk, but schema and hook changes still require disposable rollback rehearsal.

## Next step

Proceed to Checkpoint 1 only when separately authorized. Do not implement tasks until apply is explicitly requested.
