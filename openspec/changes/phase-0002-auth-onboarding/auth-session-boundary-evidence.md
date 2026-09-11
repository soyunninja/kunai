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
| Concurrent A/B isolation | Parallel session restoration for User A/User B returns correct independent identities. | PASS |
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

Focused results: `tests/server/auth-session-boundary.test.ts` passed, 18 tests; `tests/server/auth-routes-h3.test.ts` passed, 6 tests.

## Gate result

Checkpoint 3 result before native review: **PASS**.

No contradiction was found with the approved HttpOnly/request-scoped architecture. No token was exposed to frontend JSON/state/storage, and no superuser credentials are used for application login/session primitives. Checkpoint 4 work was not started.
