# Checkpoint 3 Evidence — Auth/session boundary

Change: `phase-0002-auth-onboarding`

Date: 2026-09-11

Scope: Implement and verify the secure Nuxt server boundary for browser session primitives: browser → Nuxt server → PocketBase using the user's identity. This checkpoint does not implement onboarding UI, geolocation, avatar selection UI, SSR route middleware, operational Home seed, dashboard UI, grid, settings, or functional widgets.

## Implemented primitives and endpoints

| Path | Purpose |
|---|---|
| `server/utils/pocketbase-client.ts` | Creates a fresh PocketBase SDK client/AuthStore per request context and imports the cookie token only into that request. No authenticated global client is used. A second call with a different token on the same request fails explicitly instead of ignoring the token. |
| `server/utils/session-config.ts` | Validates required private app origin and explicit cookie mode; maps production secure vs development HTTP cookie behavior. Startup validation fails fast instead of deferring unsafe session config to first request. |
| `server/utils/session.ts` | Central session primitives: safe DTO projection, cookie set/clear, login, session restore/refresh, invalid-session cleanup, logout. It updates request-local auth intent metadata after login/refresh and clears it on invalidation/logout. |
| `server/utils/same-origin.ts` | Same-origin protection for unsafe cookie-authenticated operations using configured origin plus Fetch Metadata when present. |
| `server/utils/h3-adapters.ts` | H3 boundary adapters for real request headers and cookie read/write/delete helpers. |
| `server/utils/runtime-config.ts` | Thin runtime-config seam used by H3 route handlers and focused H3 route tests. |
| `server/utils/api-error.ts` | Sanitized API error shape. Test-only secret leak helper lives in `tests/server/secret-free-string.ts`. |
| `server/api/auth/login.post.ts` | Email/password login through PocketBase normal user auth; sets HttpOnly cookie and returns safe session DTO. |
| `server/api/auth/session.get.ts` | Restores/refreshes session from the HttpOnly cookie and returns safe session DTO or null. |
| `server/api/auth/logout.post.ts` | Same-origin logout primitive that clears cookie and request AuthStore without promising global token revocation. |
| `shared/types/auth.ts` | Browser-safe session DTO and envelope types. |

## Cookie strategy

| Mode | Name | Secure | HttpOnly | SameSite | Path | Domain |
|---|---|---:|---:|---|---|---|
| Production / secure | `__Host-kunai_session` | true | true | `Lax` | `/` | not set |
| Explicit development HTTP | `kunai_session` | false | true | `Lax` | `/` | not set |

The cookie value is the raw PocketBase bearer token and is never returned in JSON. When a token contains a JWT `exp`, `Max-Age` is bounded to remaining token lifetime. Invalid sessions clear the cookie with the same security shape. Logout clears the cookie and the request-local AuthStore only; it does not claim global token revocation.

## Safe session DTO

```ts
interface SafeSessionDto {
  id: string
  displayName: string
  avatarKey: string
  onboardingCompleted: boolean
}
```

Excluded from browser responses: PocketBase token, cookie value, password, email, full auth payload, admin fields, auth-store exports, provider payloads.

## Security/session test matrix

| Requirement | Evidence | Status |
|---|---|---|
| Valid login creates session | `auth-session-boundary.test.ts` logs in User A through real disposable PocketBase and receives safe DTO. | PASS |
| Invalid login is safe | Invalid password returns sanitized `invalid_credentials` and emits no console error/log containing secrets; transient PocketBase login outage returns sanitized `session_unavailable` instead and does not clear an existing valid session cookie. | PASS |
| Cookie flags | Development and production cookie names/flags verified; host-only Domain absence asserted. | PASS |
| Token absent from response JSON | Login and session restoration assert response JSON does not contain cookie token. | PASS |
| Safe session DTO | DTO contains only `id`, `displayName`, `avatarKey`, `onboardingCompleted`. | PASS |
| Session restored/refreshed | Cookie token loads into request-scoped PB client; `authRefresh()` returns expected user and rotates cookie. | PASS |
| Invalid/expired session clears cookie | Invalid token resolves to null session and marks cookie deleted. | PASS |
| Transient refresh outage preserves cookie | Unreachable PocketBase returns `session_unavailable`, leaves the cookie intact for retry, and a later recovered request restores the session without forcing login. | PASS |
| Logout clears session | Logout clears request AuthStore and cookie without exposing token. | PASS |
| Request A/B isolated | Separate request events produce distinct PB clients/AuthStores for User A/User B; anonymous→authenticated, authenticated→anonymous, and different-token memoized calls fail explicitly; same-token repeated calls reuse the request client; refreshed token metadata is synchronized after session refresh; transient refresh failures clear request-local stale client metadata for same-request retry. | PASS |
| Concurrent A/B isolation | Parallel session restoration for User A/User B returns correct independent identities, distinct request clients/AuthStores, and per-request rotated cookie/auth metadata. | PASS |
| Concurrent invalid + valid isolation | An invalid concurrent cookie resolves to anonymous, clears only its own cookie/request auth metadata/AuthStore, and does not affect a simultaneous valid user's restored identity or cookie. | PASS |
| Concurrent outage + valid isolation | A transient PocketBase refresh outage returns `session_unavailable`/503, clears stale server request metadata, preserves that request's retryable cookie, does not affect a simultaneous valid user, and restores correctly after the runtime becomes reachable again. | PASS |
| Same-request auth intent coherence | Repeated `resolveSession` calls with the same auth intent inside one request remain on the same user identity and keep event auth metadata aligned with the active cookie. | PASS |
| Cross-origin unsafe rejected | Mismatched origin plus cross-site metadata rejected. | PASS |
| Same-origin allowed | Configured origin plus `same-origin` Fetch Metadata accepted. | PASS |
| Errors/logging without secrets | Invalid login test spies console and verifies safe message does not include password/email. | PASS |
| PocketBase endpoint not public | Static guard verifies `runtimeConfig.pocketbaseUrl` is private and not under `public`. | PASS |
| H3 auth route boundary | Focused H3 tests mount login/session/logout handlers and verify JSON parsing, status codes, safe response bodies, cookie set/clear, same-origin rejection, 401 vs 503 behavior, logout, and session restoration without token exposure. | PASS |
| Session config fails fast | Startup validation requires valid `NUXT_APP_ORIGIN` plus secure/development cookie mode compatibility; invalid combinations fail before request handling. | PASS |

## Evidence commands

```sh
pnpm vitest run tests/server/auth-session-boundary.test.ts --reporter=verbose
pnpm vitest run tests/server/auth-routes-h3.test.ts --reporter=verbose
pnpm lint
pnpm typecheck
pnpm test
git diff --check
```

Focused results: `tests/server/auth-session-boundary.test.ts` passed, 21 tests; `tests/server/auth-routes-h3.test.ts` previously passed, 6 tests.

## Task 7.1 RED routing evidence

Added `tests/ssr/auth-routing.nuxt.test.ts` as a RED Nuxt suite defining the expected SSR/client-navigation auth state machine for `/login`, `/onboarding`, and `/` without implementing middleware, session plugins/composables, or final pages.

Covered states and scenarios:

- anonymous access to `/` and `/onboarding` redirects to `/login` before protected/foundation content renders;
- anonymous `/login` renders only login content;
- authenticated incomplete users route to onboarding and away from login;
- authenticated completed users render Home and are redirected away from onboarding;
- expired sessions clear the session cookie and redirect to login;
- temporarily unavailable session validation returns an unavailable state without protected or stale identity content;
- authenticated SSR responses require private/no-store caching;
- rotated Set-Cookie propagation remains attached to the original SSR response;
- hydration exposes only the browser-safe session DTO shape;
- simultaneous User A/User B route renders remain isolated;
- client navigation follows the same route-state expectations.

RED command:

```sh
pnpm vitest run tests/ssr/auth-routing.nuxt.test.ts --reporter=verbose
```

RED result: **FAIL as expected**, 13 failing assertions. Current implementation still renders `app/app.vue` foundation shell with status 200 and no auth routing/session state. This is the expected pre-7.2 failure mode.

Quality checks after adding the RED suite:

```sh
pnpm lint
pnpm typecheck
git diff --check
```

Quality result: **PASS**.

## Task 7.2 GREEN routing/session evidence

Implemented the approved auth/routing state machine without starting onboarding persistence, avatar UI, geolocation, Home seed, widgets, or Checkpoint 4A.

Implemented surfaces:

- `app/plugins/session.server.ts` resolves the session during SSR from the original H3 event using `resolveSession` and `h3CookieController`; it does not perform an internal `/api/auth/session` fetch, preserving Set-Cookie propagation on the original response.
- `app/middleware/auth.global.ts` applies the route state machine for `/`, `/login`, and `/onboarding` and sets response status/headers for unavailable/authenticated SSR paths.
- `app/composables/useSession.ts` stores only `SafeSessionDto | null` plus validation status/message in Nuxt state and uses a request epoch to suppress stale client responses from overlapping session/login/logout calls.
- `app/utils/auth-routing.ts` centralizes the route decision table used by middleware and focused tests.
- Minimal `app/pages/login.vue`, `app/pages/onboarding.vue`, and `app/pages/index.vue` render route shells only; no onboarding form, avatar UI, geolocation, Home seed, dashboard, or widgets were introduced.
- `app/app.vue` now renders `<NuxtPage />` while preserving the existing appearance selector contract.

Final state machine:

| State | `/login` | `/onboarding` | `/` |
|---|---|---|---|
| Anonymous | render Login | 302 to `/login` | 302 to `/login` |
| Authenticated, onboarding incomplete | 302 to `/onboarding` | render Onboarding | 302 to `/onboarding` |
| Authenticated, onboarding complete | 302 to `/` | 302 to `/` | render Home |
| Expired/invalid session | anonymous behavior with session cookie cleared | anonymous behavior with session cookie cleared | anonymous behavior with session cookie cleared |
| Session validation unavailable | 503 unavailable page, no protected stale identity | 503 unavailable page, no protected stale identity | 503 unavailable page, no protected stale identity |

Validation commands:

```sh
pnpm vitest run tests/ssr/auth-routing.nuxt.test.ts tests/ssr/session-composable.nuxt.test.ts --reporter=verbose
pnpm lint
pnpm typecheck
pnpm test
git diff --check
```

Results: **PASS**. Focused Nuxt routing/session suites passed 15 tests; full `pnpm test` passed 8 files / 81 tests. `git diff --check` reported no whitespace errors.

## Gate result

Task 5.3 server-side session race triangulation result: **PASS**.
Task 7.1 SSR/client-navigation auth state-machine RED suite result: **PASS for RED definition**.
Task 7.2 SSR/client session routing GREEN result: **PASS**.

No contradiction was found with the approved HttpOnly/request-scoped architecture for server-side session refresh races and request isolation. No token was exposed to frontend JSON/state/storage, and no superuser credentials are used for application login/session primitives. Checkpoint 4 work was not started.

Checkpoint 3 implementation tasks are complete, but Checkpoint 3 is not closed until its final gentle-ai review/acknowledgement is completed. Checkpoint 4A remains blocked.
