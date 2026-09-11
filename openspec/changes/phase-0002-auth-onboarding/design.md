# Design — Phase 0002 authentication and onboarding

## Decision and scope

Nuxt owns the browser session and all browser-facing data operations. PocketBase authenticates administratively provisioned users and enforces ownership independently. Onboarding creates durable, uniquely identified Home placeholders; a PocketBase-side transactional completion guard makes completion truthful even through direct normal API requests.

This is a design, not implemented or verified behavior. The only artifact created in this execution is this file. The next phase is tasks, not apply or Phase 0003.

### Inputs and source reconciliation

Read the approved [proposal](./proposal.md), [exploration](./explore.md), all four change specs, all canonical OpenSpec specs, `AGENTS.md`, `START_HERE.md`, project context/rules/decisions/phase map, the Phase 0002 brief, all architecture documents and ADRs, product vision/MVP, onboarding/default-Home/visual UX, avatar guidance, local setup, and current application/configuration/tests.

The approved change explicitly narrows older onboarding UX's manual city search/correction to future weather/geocoding work. This phase offers location clearing/re-detection and an optional non-geocoded label, not city lookup. The canonical foundation's neutral shell and undecided access boundary are deliberately modified by the approved delta specs. Project context still describes archived Phase 0001, not an implementation blocker. There is no unresolved source contradiction requiring owner intervention.

### Current implementation and constraints

- Nuxt 4.4.8, Vue 3.5.40, strict TypeScript, Tailwind 4, pnpm; one root application, not `packages/coding-agent` or a monorepo.
- `app/app.vue` is a neutral main landmark with a non-persistent appearance selector; `useTheme` already supports dark/light/system.
- `server/utils/pocketbase.ts` validates the private endpoint; its startup plugin performs no network I/O. Preserve that behavior.
- Vitest/node and Nuxt/happy-dom tests exist. No SDK, auth pages, application schema or data services exist.
- PocketBase is pinned to 0.40.3. The official SDK must be pinned after compatibility testing; do not infer a matching SDK version number.
- No grid, legal widget sizes, dashboard lifecycle UI, functional widgets/bookmarks, providers, settings shell, finance/calendar/travel/dev/AI, signup, OAuth, reset or verification flows are designed here.

## 1. Authentication and data flow

### Boundary and request lifetime

Browser → same-origin Nuxt API → one request-scoped PocketBase client → PocketBase using that user's bearer identity. SSR invokes the same server session/data utilities against its original H3 event, not browser-facing PocketBase APIs. No ordinary operation uses a superuser or a runtime administrative client.

`getRequestPocketBase(event)` creates the SDK with an explicit fresh in-memory auth store, the existing validated private endpoint, and the token read from the cookie. Store the client and one session-resolution promise only on that event's context. Never put either in module state, a Nitro-wide cache, browser storage, or a global Vue store. Memoization within one request prevents repeated refreshes; separate requests never share mutable credentials. Disable SDK request auto-cancellation where same-request independent operations could otherwise cancel each other.

Normal user CRUD is implemented as small server-owned operations, not an arbitrary PocketBase proxy. Derive `owner` from the validated record ID, reject unknown input fields (including owner, dashboard IDs and completion markers on onboarding), use bound SDK filter values, whitelist writes and project bounded response DTOs. Validate related records before writes, while retaining PocketBase rules as independent authority.

Future provider credential storage or background administration may need narrowly privileged server services because normal users cannot read secret collections. Such services require their own approved design, authorization and secret handling; this phase introduces neither credentials nor privileged access paths. Offline administrator provisioning and disposable-test setup are not normal application CRUD.

### Cookie and session policy

| Concern | Contract |
|---|---|
| Production cookie | `__Host-kunai_session`; raw PocketBase token only; `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no Domain |
| Development HTTP | Explicit private `sessionCookieMode=development-http`, allowed only in Nuxt development; name `kunai_session`, same attributes except Secure=false |
| Default mode | Secure, including preview/production; refuse insecure mode outside development rather than weakening it based on proxy headers |
| Lifetime | Persistent cookie Max-Age bounded by the current token's remaining lifetime; use the configured PocketBase auth-token duration, not a second independent lifetime |
| Refresh | For every protected API request and SSR page request with a cookie, call `users.authRefresh()` once before trusting identity; rotate the cookie using the returned token |
| Expiry | Missing/malformed/expired or definitively rejected credential produces anonymous state and expires the cookie with identical scope attributes |
| Outage | Timeout/network/5xx is unavailable, not invalid credentials: return 503, hide protected content, retain cookie for retry; never serve stale identity |
| Logout | Same-origin POST clears cookie and request auth store without depending on PocketBase availability; does not promise global token revocation |

A local expiry decode is only an early rejection/expiry calculation, never authentication. Check auth collection and validate/project the returned record rather than serializing SDK auth results. Bound credential size before loading the auth store. Credentials enter Nuxt only through the JSON login body, never query strings. Passwords are not trimmed or normalized.

Refresh gives a sliding lifetime for a still-valid PocketBase credential; expired credentials require login. No refresh-token collection, server session table or indefinite client timer is introduced. PocketBase remains responsible for token validity and invalidation on account/security changes. Test the pinned runtime rather than assuming refresh revokes its predecessor.

Cookie updates must reach the original SSR HTTP response. A server plugin calls the shared session resolver on the original request event and initializes safe Nuxt state before route middleware runs. Avoid an SSR internal `/api/auth/session` fetch whose Set-Cookie would be lost. Subsequent client navigation calls that endpoint normally. Concurrent responses may return different valid refresh tokens; verify overlapping refresh behavior in PocketBase. Client login/logout waits for its outstanding session request before issuing the mutation and invalidates pending DTO updates so a stale client response cannot repaint a logged-out user. Stateless cookie logout does not revoke tokens held by other tabs/devices or already executing requests; document that limitation rather than claiming global revocation.

### Safe DTO and API contracts

Session response: `{ session: null | { id, displayName, avatarKey, onboardingCompleted } }`. Strings for display name/avatar may be empty before onboarding. This is the entire browser session representation: no token, email, timezone, PocketBase record, timestamps or auth-store metadata. Request-scoped server context may retain additional validated fields privately. Timezone/location belong to the separately authorized onboarding form DTO.

| Route | Input and output | Failure behavior |
|---|---|---|
| `POST /api/auth/login` | `{email,password}` → session envelope | 400 invalid shape; generic 401 invalid credentials; 429 throttled; 503 unavailable; successful auth replaces prior cookie |
| `GET /api/auth/session` | No input → session envelope | Anonymous is 200 with null; upstream outage 503, no stale identity |
| `POST /api/auth/logout` | Empty JSON object → 204 | Origin rejection happens before any cookie mutation; otherwise logout works with invalid/missing token |
| `GET /api/onboarding` | Incomplete user → persisted profile draft and preferences/location, empty values if absent | 401 anonymous; 409 already complete; 503 unavailable |
| `POST /api/onboarding/complete` | `{displayName,avatarKey,timezone,defaultLocation}` → safe session envelope | 400 field errors; 401 expired; 409 recoverable stored-state conflict; 503 transient failure |
| `GET /api/home` | Complete user → `{dashboard:{id,name}, initialized:true}` after loading that user's seeded dashboard | 401 anonymous; 409 onboarding required or inconsistent completed data; 503 unavailable |

Errors expose `{error:{code,message,fields?}}`, not raw SDK errors, submitted values, URLs or nested provider payloads. The Home landing only confirms initialization; it is not a renderer for four working widgets. APIs return statuses/JSON rather than HTML redirects.

All session, onboarding and Home responses and authenticated SSR HTML use `Cache-Control: private, no-store`; do not prerender or enable shared Nitro/CDN caching for these pages/routes. Vue renders strings as text, never raw HTML.

### Origin protection and deployment

Add private `NUXT_APP_ORIGIN` and `NUXT_SESSION_COOKIE_MODE`. Validate the configured app origin at startup: exact scheme/host/port, no credentials/path/query/fragment; HTTPS required outside explicit development HTTP mode. Keep the PocketBase endpoint private and preserve its existing optional path-prefix support. Examples contain inert placeholders only, never a real deployment endpoint or token.

Every unsafe Nuxt route, including login and logout, checks Origin against the configured application origin before body processing, cookie changes, refresh or writes. Missing, `null`, malformed or mismatching Origin is 403. If supplied, `Sec-Fetch-Site` must be `same-origin`; its absence is permitted only when Origin matches. Reject unsupported content types (415), enforce a small JSON body bound (16 KiB), and do not add credentialed cross-origin CORS. GET endpoints never perform business writes; session refresh may rotate credentials only after validation.

Use the configured canonical origin, not untrusted Host/X-Forwarded headers, as CSRF authority. Production requires browser→Nuxt HTTPS and protected Nuxt→PocketBase transport (TLS off-host; loopback/private trusted deployment explicitly documented). Reverse proxies must preserve cookies and sanitized origin metadata and exclude secrets from access/error traces. Enable PocketBase authentication rate limiting and ingress login throttling; do not claim a process-local limiter protects a multi-instance deployment.

## 2. Routing and onboarding state machine

Routes are `/login`, `/onboarding`, and `/` (minimal protected Home). There is no user-controlled return URL or external redirect.

| Resolved state | `/` or protected access | `/login` | `/onboarding` |
|---|---|---|---|
| Unauthenticated | Redirect `/login` | Render login | Redirect `/login` |
| Authenticated, incomplete | Redirect `/onboarding` | Redirect `/onboarding` | Render/resume form |
| Authenticated, complete | Render minimal Home | Redirect `/` | Redirect `/` |
| Session unresolved/unavailable | No protected render; pending/error + retry | Same safe error behavior when a cookie cannot be checked | Same |

Global middleware waits for session resolution before page setup/data rendering. SSR redirects use server responses; client middleware uses Nuxt navigation. Hydration consumes the SSR DTO without immediately repeating refresh; later navigation revalidates. APIs independently authorize even if client middleware is bypassed. Any 401 clears visible user state and navigates to login; transient failures retain no visible protected response and offer retry.

Incomplete onboarding can contain no records or partial profile/preferences/seed records. GET restores persisted data; timezone detection runs only when a persisted value is absent, on the client, not SSR. Unsaved edits need not survive refresh and are never written to browser storage. Submission disables repeated local clicks but correctness does not depend on that. Failure retains in-memory values and leaves persisted partial data retryable. Login/refresh restores the correct state; logout from either authenticated state returns to login. Completed reentry is read-only and must never reseed or reset customization.

## 3. PocketBase schema and authorization

### Migration shape

Use meaningful timestamped migrations under `pb_migrations/`: first configure `users`, then create the three owner collections and indexes; enable the bounded native batch API required by finalization. Existing default `users` must be inspected by collection ID/type and updated rather than duplicated. If an incompatible collection or existing duplicate seed data is found, fail explicitly for operator review, never erase it. Provision accounts in PocketBase administration; disable public auth-record creation, OAuth2, OTP, password-reset and verification-request application flows. Use PocketBase request hooks to reject public reset/verification endpoints if core settings do not disable them; no app facade for them exists.

Required PocketBase fields/constraints below are storage contracts; empty PocketBase text/date values map to empty/unconfigured DTO values, optional JSON maps to null. Include normal `created`/`updated` autodates on base collections. Required numeric zero values must remain valid.

| Collection | Fields and constraints |
|---|---|
| `users` (auth) | Retain built-in ID/email/password/token fields; email/password auth only, unique email identity. `displayName`: optional text until completion, trimmed 1–80 when present; `avatarKey`: optional text up to 80, approved registry key when present; `timezone`: optional text up to 100, valid IANA name when present; `onboardingCompleted`: boolean default false; `onboardingCompletedAt`: optional date, server-assigned on false→true |
| `user_preferences` | `owner`: required single relation→users; `appearance`: single select dark/light/system, seed dark; `defaultLocation`: optional bounded JSON (2 KiB), contract below |
| `dashboards` | `owner`: required single relation→users; `name`: required trimmed text 1–80; `sortOrder`: integer ≥0, seed 0; `seedKey`: optional text ≤80, onboarding value `home` |
| `dashboard_widgets` | `owner`: required single relation→users; `dashboard`: required single relation→dashboards; `type`: required stable text ≤80; `seedKey`: optional text ≤80; `config`: required bounded JSON (4 KiB); `layoutDesktop`, `layoutTablet`, `layoutMobile`: optional JSON, null for this phase |

Relations do not cascade-delete valued records. In this phase, parent deletion with dependent records is rejected; orphaning is not permitted. Later dashboard/account lifecycle phases must explicitly design cleanup. This is a referential safety constraint, not a decision about whether Home can eventually be renamed/deleted.

Indexes: unique `user_preferences(owner)`; partial unique `dashboards(owner, seedKey)` where seedKey is nonempty; partial unique `dashboard_widgets(dashboard, seedKey)` where seedKey is nonempty; supporting indexes on dashboard owner and widget `(owner,dashboard)`. These are SQLite unique indexes emitted by migrations, not SDK checks. Nonempty seed identities are immutable after creation, including rejecting promotion of an unseeded record to an occupied seed identity. Widget type is not globally unique; future unseeded duplicate instances remain possible. Home is identified by seed key, never by name.

### Access rules, all operations

`null` rules mean locked, never an empty public rule. Define authenticated as a nonempty auth ID from the `users` auth collection. For base collections, the rule predicates are:

| Operation | Required rule semantics |
|---|---|
| List/view | Authenticated AND stored `owner = @request.auth.id` |
| Create | Authenticated AND submitted required `owner = @request.auth.id`; owner relation cannot be omitted or forged |
| Update | Authenticated AND stored owner matches AND owner is unchanged (PocketBase request-body changed-field predicate) |
| Delete | Authenticated AND stored owner matches; dependent-relation and completion safety hooks still apply |
| Widget create/update | In addition, the effective dashboard relation must exist and its stored owner must equal both authenticated ID and widget owner; verify new relation on reassignment, not just old dashboard |

For `users`: create/list/delete/manage locked to administration; view self only; update self only with a bounded profile-field allowlist. Auth token/login/refresh endpoints remain available under email/password auth configuration. Normal requests cannot change ID, email, password, verified, email visibility, token fields, or any administrative field. Enforce the allowlist in a request hook as well as rule checks; ignored unknown fields must not become a future escalation path. Admin provisioning is an operator workflow, not an app role model.

PocketBase record/request hooks validate resulting values and enforce immutable owner/seed fields, effective dashboard ownership, bounded profile mutation, and completed-state monotonicity. On incomplete→complete, a server-side completion guard checks the full predicate below and assigns the timestamp; callers cannot supply an authoritative timestamp. On complete→incomplete or repeated onboarding-profile mutation after completion, reject with an identifiable conflict. No generic profile-edit API is added now; later settings design can relax profile edits while preserving completion monotonicity.

### Atomic completion guard

Nuxt-only verification is insufficient because a user can authenticate directly against PocketBase. The PocketBase users update guard must validate completion and save the marker in the same database transaction, using the event's transaction-bound app/database handle. If already inside a native batch transaction, reuse that transaction; do not read using a global app handle or commit separately. Standalone direct users updates must also execute guard+save transactionally. The guard performs bounded owner-scoped reads; it never uses administrative credentials or creates records on behalf of another user.

Predicate: valid required profile and approved avatar; one preferences record with valid appearance/location; one owner-matching Home seed; exactly one matching seeded widget for each required key and type, with valid initial configs tied to the final timezone/location; null layouts at initial completion. The normal onboarding endpoint creates no other dashboards/widgets. Unrelated preexisting data is neither deleted nor silently relabeled; an incompatible initial state produces a recoverable conflict/operator diagnostic rather than a false fresh-user success.

The transaction closes the check/save race with concurrent deletion or mutation. Completion certifies initial state at commit, not an eternal prohibition on later user customization. A completed account never triggers automatic recreation of removed records. The finalization guard must reject corrupt same-key records rather than trusting counts alone.

### PocketBase 0.40.3 confirmation gate

No runtime execution is available during this design. Before implementation can be accepted, confirm these exact surfaces against the pinned binary and its generated JS declarations/examples: auth collection update constructors and field APIs; required relation/JSON/date defaults; SQLite partial-index handling of empty text; `@request.body.<field>:changed` semantics for omitted/identical values; effective submitted relation traversal on create/update; native batch enablement/limits and transactional hook execution; transaction rebinding of record events and nested `runInTransaction` behavior; request-hook names for reset/verification rejection; sanitized unique/busy error codes; supported SDK refresh/auth-store APIs.

Rule syntax or hook plumbing may change to match the runtime; security and atomicity may not. If resulting-record dashboard checks cannot be expressed completely in rules, retain owner rules and enforce the missing relational predicate in PocketBase hooks for direct APIs too. If guard+save cannot be proven atomic for both batch and standalone writes, stop before apply completion and revisit the mechanism; do not substitute Nuxt-only checks, in-process locks or superuser CRUD.

## 4. Location, avatar and placeholder contracts

`defaultLocation` is a discriminated value: null; `{kind:'label',label}`; or `{kind:'coordinates',latitude,longitude,label:null|string,source:'browser'}`. Label is trimmed, nonempty and ≤120 characters. Coordinates must be finite latitude [-90,90] and longitude [-180,180], accepted only together. A label has no implied coordinates or resolved city. Do not persist accuracy, altitude, movement history or browser permission status. Client coordinates are user input, not verified physical location.

The form offers “Use browser location”, “Clear location / skip” and an optional location-label input explicitly marked not resolved to a weather location. Permission is requested only on the first action in a secure context; denial/timeout/unavailable/failure are nonfatal status messages. A label can annotate coordinates or stand alone; clearing removes coordinates. No mandatory manual latitude/longitude fields and no external calls. Timezone uses Intl detection, a correctable text/selection input, and server IANA validation with explicit feedback; do not derive it from coordinates or silently select UTC.

`shared/avatars.ts` will contain a small immutable registry of `{key,src,label}` entries. Assets live in `public/avatars/`; only approved root-relative bundled paths are allowed. Keys are independent of filenames, unique and stable; persist only the key. The registry and PocketBase validation allowlist must come from the same reviewed owner-supplied manifest, with a test proving parity across runtimes. Do not invent entries now. Unknown persisted keys display an explicit unavailable-avatar state and prevent incomplete onboarding completion, not an invented fallback avatar. Owner supplies assets and final keys before avatar implementation is accepted.

| Seed key / type | Initial config |
|---|---|
| `search` | `{version:1,engine:'google'}`; built-in default, no search-engine record or functional control |
| `clock` | `{version:1,timezone:<validated selected timezone>}`; no running clock yet |
| `weather` | `{version:1,location:<defaultLocation>,status:'unconfigured'}`; even coordinates do not configure a provider in this phase |
| `bookmarks` | `{version:1}`; no links and no normalized bookmark collection |

All three layout fields are null, not `{}` and not guessed sizes. These are four seed payload schemas, not the future widget registry or legal-size system.

## 5. Concrete idempotent onboarding algorithm

Use unique indexes for durable identity and ordinary authenticated PocketBase record APIs for all writes. No process lock or check-then-create-only algorithm is authoritative.

1. Enforce same-origin, resolve the user, validate the whole input before writing. Reload the user from PocketBase. If complete, return its current safe DTO without changing preferences, names, configs or seed records.
2. Persist the incomplete profile with no completion marker. Ensure preferences by owner; create if missing. On a confirmed unique collision reload by the exact owner identity and validate it. Existing valid preferences remain available for recovery; the final transaction applies the submitted snapshot.
3. Ensure dashboard `(owner,'home')` with name Home and sortOrder 0. Load if present; otherwise create. On a confirmed unique collision reload and validate ownership/seed identity. Never select a dashboard by display name or adopt a different owner's record.
4. Ensure each `(dashboard,seedKey)` in fixed search/clock/weather/bookmarks order. Create missing placeholders using the validated snapshot. A competing create's uniqueness error means reload the exact identity; any other validation/permission error is not swallowed. Preserve existing IDs and valid records. Reject mismatched type/owner or non-placeholder customization as `seed_conflict`; never delete it to force convergence.
5. Reload the snapshot and user. If completed by a competing request, return its persisted DTO without writes. Otherwise submit one bounded native PocketBase batch under that user's token: update preferences to the submitted location (preserving existing appearance), reconcile only incomplete onboarding clock/weather placeholder configs to that snapshot, and update required user fields plus completion last. The final users operation invokes the transactional completion guard. All final snapshot changes and the marker commit together or roll back together.
6. A uniqueness conflict in any creation step reloads its winner. A final batch conflict, concurrent completion or SQLite busy/retryable response triggers a fresh bounded reload/retry, at most three attempts per Nuxt request with short jitter. If another request completed, return the committed winner without applying the losing payload. The PocketBase users guard rejects a competing batch that attempts to change an already-completed profile, rolling its earlier config writes back. Thus first successful final transaction wins conflicting submissions; there is no mixed clock/profile/location result.
7. After success, reload the profile and return only the safe DTO. If the response is lost, refresh or resubmission observes completion and succeeds read-only. On exhausted retries return a recoverable error; completion is never optimistically reported.

Failures during steps 2–4 leave partial durable records with completion false. Failure in step 5 leaves the pre-finalization state intact. Retry fills gaps and reuses seed IDs rather than starting over. If token expiry occurs after partial writes, return 401 and clear cookie; login returns to the same incomplete state. If a concurrent request completes while another fails, the error is not evidence that persisted onboarding is still incomplete: client refresh resolves authoritative state.

Exactly-once identity follows from the preferences and partial seed indexes; eventual completion follows from repeated ensure/reload; truthful completion follows from the database-side atomic predicate; snapshot consistency follows from final batch rollback and completed-profile write rejection. Do not rely on UI disabling, a single server instance, or ordering of HTTP responses.

## 6. Planned Nuxt and PocketBase file changes

These paths describe future implementation, not files created by this design.

| Paths | Responsibility |
|---|---|
| `app/app.vue`, `app/components/AppearanceControl.vue` | Replace neutral content with NuxtPage; retain one accessible appearance control and main landmark per page; no persisted theme UX added |
| `app/pages/login.vue`, `onboarding.vue`, `index.vue` | Forms and minimal Home confirmation with logout; no dashboard tabs/grid |
| `app/middleware/auth.global.ts`, `app/plugins/session.server.ts` | Route state machine and original-event SSR session initialization |
| `app/composables/useSession.ts`, `useOnboarding.ts` | Nuxt request-isolated useState DTO and bounded API actions; form/geolocation lifecycle; no Pinia or client SDK |
| `app/components/AvatarPicker.vue` | Native radio semantics, labels, visible selection/focus, touch targets |
| `shared/types/auth.ts`, `shared/types/onboarding.ts`, `shared/validation/onboarding.ts`, `shared/avatars.ts` | Safe DTOs, pure parsing, approved static registry; no server imports or credentials |
| `server/api/auth/{login.post,logout.post,session.get}.ts` | Thin HTTP/session boundaries |
| `server/api/onboarding/index.get.ts`, `server/api/onboarding/complete.post.ts`, `server/api/home.get.ts` | Authorized narrow operations and DTO projections |
| `server/utils/pocketbase.ts`, `pocketbase-client.ts`, `session.ts`, `same-origin.ts`, `onboarding.ts`, `api-error.ts` | Preserve endpoint parser; request factory, cookie/session lifetime, CSRF, seed service and sanitized errors |
| `server/plugins/pocketbase-config.ts`, `nuxt.config.ts`, `.env.example` | Private origin/cookie mode validation, no network at startup |
| `pb_migrations/<timestamp>_auth_onboarding.js` | Auth fields, three collections, constraints/indexes/rules, required batch setting and reviewed reverse behavior |
| `pb_hooks/auth_onboarding.pb.js`, `pb_hooks/lib/onboarding-validation.js` | Direct-API field/relation/seed validation, reset/verification rejection and atomic completion guard; no custom privileged CRUD endpoint |
| `public/avatars/`, owner-approved avatar manifest | Real assets only; validation parity with shared registry/PocketBase runtime |
| `tests/`, `docs/decisions/0009-nuxt-pocketbase-session-boundary.md`, relevant architecture/development docs | Verification described below and dedicated ADR/operational documentation during implementation |
| `package.json`, `pnpm-lock.yaml` | Pinned official server-only PocketBase SDK and explicit integration-test command; no major UI/state dependency |

Avoid generic repositories, event buses, hidden global state or speculative integration interfaces. PocketBase hooks run in its JS runtime, not Nuxt/Node: use a small compatible validation module/manifest there and parity fixtures with shared TypeScript validators, not unverified direct TS imports.

## 7. Validation and security assurance

Browser validation supplies immediate field errors, focus on first invalid control, pending/retry status through live regions, keyboard-operable avatar radios and tablet-sized touch targets. Nuxt revalidates unknown JSON using explicit parsers/type guards, rejects extra fields, validates timezone/registry/location/config bounds, and derives all identifiers. PocketBase fields/indexes/rules/hooks validate direct requests and final stored relationships; frontend validation is never authorization.

| Threat | Mitigation and required evidence |
|---|---|
| Bearer leakage/XSS | HttpOnly cookie; projected DTOs; no client SDK/local storage; escaped text; no raw auth errors; inspect SSR payload, document.cookie, browser storage, responses and logs using a known token sentinel |
| Cross-request identity leakage | Fresh SDK/auth store per H3 event; no shared response cache; overlapping User A/B SSR and API tests |
| CSRF/login CSRF/logout CSRF | Exact configured Origin and Fetch Metadata policy before any session mutation; test cross-origin/missing/null metadata and untouched DB/cookie |
| Forged owner or dashboard | Server-derived IDs plus direct PocketBase list/view/create/update/delete rules and resulting-relation hooks; test both existing and proposed relation values |
| Privilege escalation | No superuser configuration/runtime; self-only profile allowlist, locked auth management, admin-only provisioning; test attempts to change built-in sensitive fields |
| Expiry/upstream failure | Distinguish 401 from 503, clear only definitively invalid credentials, no stale protected DTO; test expiry between seed stages |
| Logs with secrets/PII | Log operation, sanitized category and correlation ID only; never request bodies, headers/cookies, SDK errors, profile/location or auth payloads; proxy logging included |
| Concurrent onboarding | Durable indexes, bounded conflict recovery, final atomic snapshot and PocketBase guard; test independent connections/process requests and direct premature completion |

## 8. Testing architecture

Retain strict TDD using the verified Vitest baseline. Node unit tests remain fast/offline; real Nuxt HTTP/SSR and disposable PocketBase suites are explicit, fail clearly when their prerequisites are missing, and are required for verification rather than silently skipped. Build/lint/typecheck remain separate checks, not evidence of rule correctness.

| Layer / proposed location | Observable behavior |
|---|---|
| Unit `tests/unit/` | Cookie environment flags/lifetimes/clearing, exact-origin parsing, DTO projection, timezone/location bounds, unknown fields, seed identity/error classification; fail by changing real behavior, not reasserting constants |
| Nuxt component `tests/*.nuxt.test.ts` | Required fields, radio keyboard semantics, timezone correction, no implicit geolocation call, explicit success/denial/timeout paths, retained form on failure, disabled submission and retry; preserve existing theme behavior |
| Route `tests/server/` | Real HTTP request parsing/statuses/headers with controlled PocketBase adapter; login success/failure, origin rejection before calls, logout during outage, invalid vs unavailable auth, no token-bearing response/logs, rejected mass assignment |
| SSR/routing `tests/ssr/` | Boot Nuxt and issue cookie-bearing HTML requests for every state/route; redirects before protected HTML, SSR Set-Cookie propagation, hydration DTO parity, simultaneous A/B requests, no-store headers, client 401 navigation |
| PocketBase `tests/integration/pocketbase/` | Launch checksum-verified 0.40.3 with isolated disposable data/migration/hook directories and random loopback port; apply real migrations, enable batch limits, provision two normal users through setup-only administration, then use only their tokens for assertions |
| Browser/manual | Real HTTPS cookie behavior and HTTP development mode, login/refresh/logout, denial/unavailable geolocation, optional label/null location, keyboard/tablet/touch/reduced-motion, two separate profiles, stale-tab session handling and secret inspection |

Direct PocketBase isolation matrix covers anonymous, own-user positive controls and other-user negative controls for every operation on each collection. Assert list contents (rule filtering may return empty 200), inaccessible view/update/delete and unchanged victim records, not a single assumed status code. Include forged owner creation/reassignment, omitted owner on update, same-owner relation change positive control, cross-owner relation change denial, auth field mutation, blocked public account creation and premature completion. Test unique indexes with simultaneous native creates; normal rule tests must not accidentally use an admin token.

Seed integration tests start from empty and deliberately partial persisted states: profile only, preferences only, Home only, and each missing-widget combination. Inject failure after each actual successful persistence stage, then retry and compare IDs/counts/configs and incomplete/complete marker. Send simultaneous identical and conflicting completion payloads with separate clients; prove one committed snapshot and stable IDs. Exercise busy/unique-conflict recovery, final-batch rollback, direct completion versus concurrent deletion, lost success response, refresh reentry, token expiry midway, and completed replay preserving names/configs. A manually corrupted same-key record must produce a bounded conflict, not false completion.

Migration tests cover fresh default users and pre-provisioned accounts, re-running migration application, failed incompatible schema, disposable down/up with explicit data-loss acknowledgement, owner indexes and hook behavior. Integration harness stops processes and deletes only its own disposable database in finally blocks; never points at a developer/production PB URL. No CodeGraph worktree is created in temporary directories.

Tests verify implemented positive behavior and adversarial outcomes, not absence-only inventories of future features. Existing theme tests must be adapted to the extracted control without losing their reset/dark/system assertions. No tests, commands or runtime compatibility checks were executed by this design phase.

## 9. Dedicated ADR and rollout

During implementation create `docs/decisions/0009-nuxt-pocketbase-session-boundary.md` and link it from the ADR index. The approved architectural direction warrants Accepted status once implemented evidence is reviewed; this design does not create or falsely mark that ADR accepted now.

ADR content: context (Nuxt SSR with private PocketBase endpoint); decision (server-owned HttpOnly bearer cookie, fresh request auth store, minimal DTO, normal-user data access); alternatives (browser SDK/local-storage bearer exposes reusable credential to JS; process-global SDK risks cross-user SSR leakage; superuser proxy bypasses user rules; opaque server session table adds unnecessary state); consequences (Nuxt intermediary/refresh latency, HTTPS/origin deployment requirements, explicit outage handling and stateless logout limitation); security (CSRF, no-token client boundary, safe logs/caching, ownership rules mandatory because direct API tokens remain possible); administrative provisioning and future privileged-service separation. Reference ADRs 0002, 0007 and 0008.

Rollout requires owner-supplied avatars/keys, pinned runtime/SDK compatibility evidence, passing direct-rule/concurrency tests, protected origin/cookie configuration, and operator backup before migrations. Deploy schema and hooks together before exposing auth/onboarding routes; do not run a schema missing its completion guard. Rehearse disposable migration up/down, automated production-cookie flag/configuration checks, and real HTTPS/proxy SSR behavior when such an environment is available during Phase 0002. If no real HTTPS/proxy deployment exists yet, record that deployment validation as pending for Hardening/release and do not weaken cookie or origin security to make local tests pass. Document PB provisioning, native batch limit (at least four finalization operations, bounded to a small deployment maximum), hooks path, test prerequisites and sanitized troubleshooting. Keep appearance UX non-persistent while seeding the future preference default dark.

If security fails, disable exposure of protected flows and forward-fix or restore an approved backup with a compatible app/hook release. Never weaken rules or fall back to superuser CRUD. Do not automatically drop provisioned users or valued seed records. Reverse migration removes only this phase's schema/settings additions in deliberate dependency order on disposable data; live destructive rollback requires explicit operator authorization. Repair interrupted onboarding through the idempotent path, not deletion. Update project context/phase map only after verified progress/archive under the repository contract, not during this design-only execution.

## 10. Risks, approvals and handoff

- No new owner product/security approval is needed for the documented server-owned boundary, admin provisioning, null location or deferred grid/providers: these are already approved. No real contradiction was found.
- Owner-provided real avatar assets and final stable keys remain an apply gate; the design intentionally contains neither invented keys nor substitute assets.
- PocketBase transaction-bound hook behavior, native batch semantics, rule syntax and SDK version are explicit compatibility gates. Test failure may require a mechanism revision, never a silent weaker guarantee. These are technical verification obligations, not evidence already obtained.
- HTTPS/proxy configuration and rate-limit deployment need operator verification when an environment exists; if no real deployment is available during Phase 0002, deployment validation remains pending for Hardening/release while automated cookie/security checks and documentation remain required. Stateless logout does not revoke all bearer copies or already-running work.
- Implementation spans security/schema/UI areas and likely exceeds a single 400-line review unit. Under ask-on-risk, the owner has resolved delivery for Phase 0002: no chained PRs; implement on `feat/phase-0002-auth-onboarding` using risk checkpoints and small coherent commits. No push, merge or PR is authorized without explicit approval.
- Skill resolution: `fallback-path`. No phase-skill path was injected; attempted dedicated sdd-design paths and a targeted fallback search found none. Applied the supplied SDD executor contract plus available Gentle AI and cognitive-document-design guidance. Parent should inject the indexed phase skill path next time.
- Tooling limitation: shell and CodeGraph intelligence were unavailable, so the supplied workspace context and targeted filesystem reads established the implementation baseline. No git-root command, CodeGraph query, runtime verification or diff check is claimed.

Next recommended: tasks for this change only, after design review. Do not apply, create delivery artifacts or start Phase 0003 from this execution.
