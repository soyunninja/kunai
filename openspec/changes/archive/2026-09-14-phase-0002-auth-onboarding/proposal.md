# Proposal — Phase 0002 Authentication & Onboarding

## Intent

Enable administratively provisioned users to sign in to a private personal startup page, complete a minimal profile, and reliably receive their initial Home records. Use the now owner-approved server-owned PocketBase session carried in an HttpOnly Nuxt cookie, with request-scoped PocketBase clients and defense-in-depth owner isolation.

Phase 0001 provides the verified foundation but no application authentication, ownership schema, or onboarding. This change establishes those prerequisites for later dashboard and widget phases; it does not deliver functional widgets or a dashboard editor.

## Basis and status

- Change: `phase-0002-auth-onboarding`.
- Inputs: [completed exploration](./explore.md), [phase brief](../../../../docs/phases/0002-auth-onboarding.md), and the project standards, accepted decisions, phase map, product vision/MVP, and architecture overview.
- The owner has now approved the proposal direction for the auth/session architecture and account-provisioning approach. No earlier confirmation is assumed, and no inferred scope expansion is required.
- This artifact is planning only. Implementation, specification, design, tasks, verification, and archive are not performed or authorized by this proposal-only execution.

## Scope / What changes

### 1. Login, logout, and protected navigation

- Authenticate PocketBase `users` by email/password through Nuxt server routes. Provision MVP accounts through PocketBase administration; disable public self-registration.
- Keep the PocketBase endpoint private. Store the PocketBase bearer token only in a host-only Nuxt cookie with `HttpOnly`, `SameSite=Lax`, path `/`, and `Secure` under production HTTPS. Development behavior must be explicit.
- Create a fresh PocketBase client/auth store for each SSR request or protected API request. Validate/refresh authentication with PocketBase as required; clear invalid or expired sessions. Never share a mutable process-global auth store.
- Return only a minimal serializable session DTO, not tokens or auth payloads. Do not expose credentials through browser state, response bodies, public configuration, logs, or client SDK storage.
- Protect unsafe cookie-authenticated operations with same-origin request validation. Derive ownership from the authenticated server session and whitelist mutable fields.
- Restore authenticated state safely on refresh. Route unauthenticated users to login, incomplete users to onboarding, and completed users to a minimal protected Home landing, without rendering protected state before authorization.
- Logout clears the cookie and request auth store; it does not promise global revocation of every PocketBase token.

### 2. Minimal profile and owner-scoped persistence

- Add the required profile baseline: display name, stable bundled-avatar key, validated IANA timezone, and onboarding completion marker/timestamp.
- Introduce only the necessary owner-scoped `user_preferences`, `dashboards`, and `dashboard_widgets` records using reviewed `pb_migrations/` source. Maintain one preferences record per owner, with nullable default location.
- Require owner relations and PocketBase list/view/create/update/delete rules that prevent cross-user access and ownership reassignment. Profile access is restricted to the authenticated user's allowed fields.
- Validate that each widget's dashboard belongs to the same owner, including relationship changes; a submitted dashboard ID is not authorization.
- Route normal browser CRUD through the consistent Nuxt boundary, using the requester's PocketBase identity rather than superuser credentials. PocketBase access rules remain a second authorization frontier and must independently protect direct normal API access.
- Keep layouts nullable/unconfigured. Do not choose widget dimensions, grid coordinates, or device layouts in this phase.

### 3. First-login onboarding

- Collect display name and a selection from the owner-provided bundled 8-bit avatar registry. Persist the stable key, not uploaded image data.
- Detect timezone with the browser's Intl API and validate it before persistence. Invalid or unavailable values require explicit correction rather than a hidden fallback.
- Request browser geolocation only after an explicit user action in a secure context. Denial, timeout, failure, or unavailable geolocation must not prevent completion.
- Permit location to remain explicitly `unconfigured`/`null`, retaining an explicit unconfigured weather state. Normal onboarding UX must not require manual latitude/longitude entry.
- Do not introduce city-name search, geocoding, reverse geocoding, or a weather provider. City-name search/correction belongs to the later phase that introduces weather/geocoding. A user-entered label, if allowed in this phase, is only a label and must not pretend to be geocoded.
- Provide clear validation, loading, and recoverable failure feedback with keyboard-accessible and tablet-touch-usable controls, following the existing dark-first terminal-inspired style.

### 4. Idempotent default Home seed

Completion ensures the following initial records for a newly onboarded user:

| Record | Initial configuration |
|---|---|
| One `Home` dashboard | Stable onboarding seed identity; no layout coordinates |
| One `search` widget | Built-in Google default placeholder |
| One `clock` widget | Selected user timezone |
| One `weather` widget | Explicit unconfigured placeholder, or selected geolocation/location state when safely available |
| One `bookmarks` widget | Empty; no seeded links |

Use durable seed keys and database uniqueness constraints for the owner/dashboard seed and dashboard/widget seed identities, or equivalent guarantees. Do not enforce uniqueness by widget type generally: later phases allow multiple instances of a type.

Completion upserts the profile/preferences and load-or-creates each required seed record. Recover uniqueness conflicts by loading the existing record. Refreshes, concurrent requests, retries, and partial-write failures must converge on the same seed set without duplication. Mark onboarding complete only after all required records exist; preserve recoverable partial state for retry rather than presenting false completion.

Create neither Travel nor Dev. The protected landing confirms the initialized private Home state without prematurely implementing the widget engine or provider-backed behavior. Weather must be seedable in an unconfigured state. Seeding must not establish later Home rename/delete policy or overwrite later user customization.

## Non-goals

- Public registration, social login, password reset, or email verification flows; any later addition requires owner approval.
- Organizations, teams, workspaces, roles, collaboration, or shared dashboards.
- Dashboard tab lifecycle/editing, widget manipulation, size matrices, responsive layout persistence, or a full widget registry/grid implementation.
- Functional Search/Clock/Weather/Bookmarks, bookmark records, search-engine management, or a Settings shell.
- Weather retrieval, location-provider search, geocoding, or other external integrations.
- Arbitrary avatar uploads, invented replacement assets, internal universal search, or command palettes.
- Any other deferred product area in the project standards.

## Affected areas

These are expected later implementation areas, not files changed by this proposal:

| Area | Expected impact |
|---|---|
| `pb_migrations/` | Auth/profile fields, minimal ownership schema, access rules, seed uniqueness, rollback behavior |
| `server/utils/`, `server/api/` | Request-scoped PocketBase sessions and bounded auth/onboarding operations |
| `app/` | Login, onboarding, route protection, typed session state, minimal Home landing, bundled-avatar selection, geolocation/unconfigured-location UX |
| `package.json`, lockfile | Official PocketBase SDK after compatibility validation |
| Private Nuxt configuration | Preserve endpoint privacy; make cookie/deployment assumptions explicit |
| `tests/` | Session, authorization, input validation, seed recovery/concurrency, and integration coverage |
| Architecture/operational documentation | Create a dedicated ADR for the approved Nuxt/PocketBase auth-session architecture, consequences, admin provisioning, and deployment prerequisites |

No stack replacement is proposed. Later phases consume this owner/session boundary and seed data rather than creating parallel access paths.

## Risks and implementation gates

| Risk / gate | Required treatment |
|---|---|
| Missing avatar assets and final stable keys reported by exploration | Owner-provided assets and approved keys are required before avatar selection can be implemented/completed in apply. Do not substitute uploads or fabricated assets. This does not block proposal/spec/design planning. |
| PocketBase runtime compatibility | Verify SDK compatibility and exact migration/rule semantics against the documented PocketBase `0.40.3` runtime during design/apply; prose security requirements are not migration validation. |
| Cross-user data exposure | Exercise two normal users and direct PocketBase API attempts for every operation, ownership reassignment, and widget/dashboard relationship tampering. |
| Cookie and SSR leakage | Verify HTTPS/proxy configuration, cookie flags, expiry/refresh, request isolation, same-origin enforcement, and absence of tokens in client-visible state and logs. |
| Partial or concurrent onboarding | Database uniqueness plus retry recovery must protect every seed step; a read-before-create check alone is insufficient. |
| Location UX boundary | Keep denial/failure/timeout/unavailable/skip non-blocking. Do not require manual latitude/longitude as normal UX. Keep location explicitly unconfigured/null when needed. City-name search/correction remains future weather/geocoding scope, not a hidden dependency. |
| Administrative provisioning burden | Document account provisioning; do not compensate with unapproved signup or recovery flows. |
| Security-sensitive review breadth | Later tasks should isolate schema/rule tests, session boundary, and onboarding UI. Under `ask-on-risk`, pause for a delivery decision if a work unit forecasts exceeding the 400-changed-line budget; no chain or exception is assumed. |

## Rollback

The proposal itself can be revised or reverted without runtime or database effects.

For later implementation, retain a pre-migration PocketBase backup and a compatible application release. If authentication or isolation fails, stop exposing the new protected flows rather than weakening rules or using privileged runtime credentials. Clear the application session cookie where feasible; cookie clearing is not global token revocation.

Rehearse migration reversal on disposable data. Do not automatically drop provisioned accounts, profiles, preferences, or seed records in a live environment. Once real user data exists, require an operator-approved backup/restore or forward-fix plan before destructive rollback, and avoid running an incompatible application against the new schema. Repair interrupted onboarding through its idempotent completion path rather than deleting user data.

## Success criteria

1. An administratively provisioned user can log in, refresh safely, and log out; public registration is unavailable.
2. SSR and client navigation consistently distinguish unauthenticated, incomplete-onboarding, and completed users without exposing protected state.
3. Tokens remain unavailable to browser JavaScript, and simultaneous requests cannot exchange session identity.
4. User A cannot list, view, create, update, or delete User B's data through Nuxt or direct normal PocketBase API access, including forged owners and dashboard relationships.
5. Onboarding persists a validated profile, approved bundled-avatar key, timezone, and either safe geolocation-derived location state, a non-geocoded user label if allowed, or explicit absence. No upload path exists.
6. Geolocation denial, failure, timeout, unavailable APIs, and skipped location allow successful onboarding without external provider calls or manual latitude/longitude entry.
7. Fresh onboarding creates exactly one Home and exactly one each of `search`, `clock`, `weather`, and `bookmarks`, with the stated placeholders and no Travel/Dev.
8. Retries, concurrent submissions, refreshes, and injected partial-write failures converge without duplicate preferences or seed records; completion is never marked before the complete seed exists.
9. Later automated checks and manual SSR/browser/PocketBase checks supply evidence for these criteria; this proposal claims none have run.
10. No non-goal implementation or unapproved provider dependency is introduced.

## Next step

Recommend specification as the next SDD phase when separately requested. Carry the avatar-content apply gate, auth-session ADR requirement, location/geocoding boundary, and runtime/security validation obligations forward. Stop this execution after saving this proposal; do not create spec, design, tasks, application code, or delivery artifacts.
