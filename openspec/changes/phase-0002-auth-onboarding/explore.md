# Explore — Phase 0002 Authentication & Onboarding

## Scope and evidence

- Change: `phase-0002-auth-onboarding`
- Artifact store: OpenSpec
- Phase brief: `docs/phases/0002-auth-onboarding.md`
- Dependency: Phase 0001 is verified and archived; its Nuxt SSR baseline, private PocketBase endpoint configuration, Vitest capability, and migration workflow are available.
- Read: project context/rules/decisions/phase map, product vision/MVP/user flows, architecture overview/configuration/security/data model/widget system, Phase 0002 brief, onboarding/default-Home/weather UX and integration guidance, PocketBase migration and isolation ADRs, Foundation canonical specs and implemented server/client baseline.

CodeGraph’s index directory exists, but this executor has neither a CodeGraph MCP tool nor a command-execution tool. The implementation map below therefore uses targeted read-only file inspection after the required index check; no repository commands, compatibility verification, or browser/database testing is claimed.

## Current implementation boundary

Phase 0001 supplies an SSR Nuxt 4 application with a neutral root shell, private `runtimeConfig.pocketbaseUrl`, endpoint validation in `server/utils/pocketbase.ts`, and no PocketBase SDK, schema, application routes, auth state, data-access layer, pages, or product records. PocketBase `0.40.3` is the documented local runtime and `pb_migrations/` is the accepted migration source location.

The existing target data model already establishes an auth `users` collection and owner-scoped `user_preferences`, `dashboards`, and `dashboard_widgets` collections. It intentionally leaves migration syntax to the owning phase. Widget IDs `search`, `clock`, `weather`, and `bookmarks` are established, but legal sizes and layouts remain Phase 0004/0005 work.

## Approved technical direction: server-owned PocketBase session

The owner has now explicitly approved a **Nuxt server-owned PocketBase SDK strategy** for this project:

1. Nuxt server routes authenticate email/password against PocketBase and write the returned PocketBase bearer token only into a Nuxt session cookie. The browser never receives the token in a response body, public runtime configuration, Pinia/local storage, or an SDK auth store.
2. The cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/`, host-only, and `Secure` in HTTPS production. Use an HTTPS deployment prerequisite; development behavior must be explicit rather than silently weakening production flags. Unsafe server actions also validate same-origin request metadata to protect cookie-authenticated mutations.
3. Every SSR request and protected Nuxt API route creates a fresh, request-scoped PocketBase client/auth store using the validated private endpoint and the cookie token. It validates/refreshes the authenticated record through PocketBase as required, clears an invalid/expired cookie, and exposes only a minimal serializable session DTO (`id`, display name, avatar key, onboarding state) to Vue.
4. Nuxt routes are the sole browser-facing data-access boundary for this phase and later normal user CRUD unless a later approved design changes it. They derive the authenticated owner from the server session, whitelist mutable fields, and never accept a caller-supplied owner as authority. A mutable process-global PocketBase client/auth store is prohibited because it can leak one SSR request’s credentials into another.
5. Normal operations run under the authenticated user's PocketBase identity, not with PocketBase superuser credentials. PocketBase access rules remain a second authorization frontier for direct normal API access and defense in depth.
6. Logout clears the Nuxt cookie and locally clears the request auth store. It does not expose a bearer token, assume a global server logout, or use PocketBase superuser credentials.

This preserves SSR refresh restoration while keeping the bearer credential unreadable to client JavaScript and keeps the existing PocketBase endpoint private. PocketBase collection rules remain mandatory: direct normal PocketBase API attempts using User A’s own token must still be unable to list, view, create, update, or delete User B’s records. Phase 0002 must create a dedicated ADR documenting this authentication/session architecture and its consequences.

## Account, schema, and ownership direction

- Use one PocketBase email/password auth collection, `users`, with public self-registration disabled. MVP accounts are provisioned through PocketBase administration; no application registration, social login, password-reset, or email-verification UX/API is added.
- Add only the profile fields needed now: required-on-completion display name, stable avatar key, IANA timezone, and an onboarding completion marker/timestamp. Users may view/update only their own profile through bounded Nuxt operations.
- Add the minimal user-owned collections necessary for onboarding: `user_preferences` (one owner-scoped record, including nullable default location), `dashboards`, and `dashboard_widgets`. Every record carries a required owner relation and all list/view/create/update/delete rules enforce the authenticated owner. Widget rules additionally require that the related dashboard belongs to the same owner; ownership must not be inferred from a client-supplied dashboard ID.
- Keep dashboard and widget fields limited to their established data-model purpose. Widget layout JSON is nullable/unconfigured in this phase because legal dimensions and initial coordinates are intentionally deferred. Do not create bookmarks, search-engine records, provider caches, settings navigation, or dashboard-editing behavior.
- Implement the collection and rule changes as reviewed `pb_migrations/` source. Exact PocketBase 0.40.3 generated migration API/rule syntax must be confirmed against the pinned runtime during design/apply; this exploration records required security semantics, not unverified schema code.

## Onboarding and idempotent seed direction

1. After login/session restoration, an incomplete profile is routed to onboarding; a complete profile is routed to the protected Home landing. Unauthenticated requests go to login. Route protection must work on SSR and client navigation without briefly rendering protected state.
2. Onboarding collects display name, one key from the bundled avatar registry, browser timezone, and optional default weather-location state. Timezone comes from `Intl.DateTimeFormat().resolvedOptions().timeZone` and is validated before persistence.
3. Geolocation is requested only from a user action in a secure browser context. A denial, timeout, failure, or unavailable API is non-fatal. Location may remain explicitly `unconfigured`/`null`; normal onboarding UX must not require the user to type latitude and longitude. Do not select a weather, geocoding, or reverse-geocoding provider in this phase. City-name search/correction belongs to the later phase that introduces weather/geocoding. If this phase permits a user-entered location label, it must be stored only as a label and must not pretend to be geocoded.
4. The completion operation upserts profile/preferences, then ensures exactly one seeded `Home` dashboard and exactly one widget per stable seed key: `search`, `clock`, `weather`, and `bookmarks`. Search uses the built-in Google default placeholder; Clock stores the selected timezone; Weather stores the selected location state or explicit unconfigured placeholder; Bookmarks has no seeded links.
5. Idempotency must hold across refreshes, retries, concurrent completion requests, and a failure after partial writes. Add durable seed keys and database uniqueness constraints for `(owner, dashboardSeedKey)` and `(dashboard, widgetSeedKey)` (or equivalent). On every completion retry, load-or-create each required record, recover from a uniqueness conflict by loading the existing record, and mark onboarding complete only after all four expected widget records exist. Do not use a read-then-create check as the only duplicate defense.

The default Home seed contains no layout sizes and creates neither Travel nor Dev. Weather must be seedable in an explicit unconfigured state when geolocation is denied, fails, expires, is unavailable, or is skipped. Later weather/geocoding work owns city-name search, correction, coordinate resolution, real weather retrieval, and richer weather states.

## Expected implementation areas for later SDD phases

- `package.json` / lockfile: add the official PocketBase JavaScript SDK only after version compatibility is resolved.
- `nuxt.config.ts`, server utilities/plugins: retain the private endpoint and add typed request-scoped client/session support without publicizing it.
- `server/api/`: bounded login, logout, session, and onboarding completion routes; no superuser runtime path.
- `app/`: login/onboarding/protected landing UI, route middleware, typed session composable, bundled-avatar registry/rendering, and accessible geolocation/unconfigured-location controls.
- `pb_migrations/`: auth/profile fields, ownership collections/rules, seed-key indexes, and reversible migration behavior.
- `docs/architecture/adr/` or the project's ADR location: dedicated ADR for the approved Nuxt/PocketBase auth-session architecture and consequences.
- `tests/`: unit/route tests for cookie/session handling, auth redirects, owner-rule semantics against a disposable PocketBase instance, onboarding retry/concurrency behavior, validation, and no-token browser exposure; manual SSR, cookie, and denied-geolocation checks remain required.

## Risks and blockers

- **Avatar content gate:** `docs/reference/avatars/` currently contains only its README; the owner-provided image files and final stable keys are absent. The app must not invent assets or allow uploads. This does not block proposal/spec/design, but apply cannot complete avatar selection until those assets/keys are supplied.
- **Migration/rule verification:** security relies on exact PocketBase 0.40.3 migration and access-rule behavior. Apply must exercise two normal accounts and direct API attempts for each operation, including cross-owner widget/dashboard relationships.
- **Cookie deployment risk:** production HTTPS, cookie attributes, token expiry/refresh behavior, and proxy headers must be verified in a real SSR deployment configuration. Never log passwords, cookies, tokens, or auth-refresh payloads.
- **Location UX boundary:** provider-free onboarding may leave location explicitly unconfigured/null and must not require manual latitude/longitude entry. A user-entered label, if allowed, is only a label and not geocoded. City-name search/correction belongs to the future weather/geocoding phase.
- **Review risk:** schema/rules, server auth boundary, and onboarding UI span several security-sensitive areas. Later tasks should isolate migrations/rule tests from session routes and UI; the 400-line review budget requires an `ask-on-risk` decision if a work unit forecasts over budget.

## Proposal handoff

The proposal should commit to the now owner-approved server-owned cookie/session model, PocketBase-admin account provisioning, a migration-backed minimum ownership schema, an auth-session ADR, and idempotent onboarding/default Home placeholders. It must keep avatar asset delivery as an apply gate, keep geocoding/city-name correction deferred to the future weather/geocoding phase, preserve the private PocketBase endpoint, and state the deferred dashboard layout, editing, weather provider, social/password-recovery/email-verification, and collaboration scope.
