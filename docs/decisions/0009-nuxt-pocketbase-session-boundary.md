# ADR 0009 — Nuxt/PocketBase session boundary

Status: Accepted

Date: 2026-09-13

## Context

Phase 0002 adds authentication, onboarding, and the minimal protected Home route for a personal per-user application.

PocketBase remains the source of identity and persisted user-owned records, but browser JavaScript must not receive the PocketBase bearer token or create arbitrary PocketBase clients. The Nuxt server owns the browser session boundary, validates requests, projects only safe session data, and performs user-owned PocketBase operations with the real user's normal identity.

This decision follows:

- [ADR 0002 — Personal Per-user Isolation](0002-user-isolation.md), which requires owner-scoped records and no shared workspace model;
- [ADR 0007 — Sensitive User Integration Credentials](0007-sensitive-credentials.md), which keeps sensitive credentials server-side after storage;
- [ADR 0008 — PocketBase migration workflow](0008-pocketbase-migrations.md), which requires reviewed PocketBase schema/rule changes and disposable-database validation.

## Decision

Nuxt owns the application session boundary for Phase 0002.

The PocketBase bearer token is stored only in an application session cookie. The client receives only `SafeSessionDto`:

```ts
{
  id: string
  displayName: string
  avatarKey: string
  onboardingCompleted: boolean
}
```

`SafeSessionDto` intentionally contains no bearer token, email, PocketBase internal collection metadata, or raw auth payload.

### Session cookie

The application session cookie is:

- `HttpOnly`;
- `SameSite=Lax`;
- path-scoped to `/`;
- host-only by not setting a `Domain` attribute;
- `Secure` in production HTTPS mode;
- non-`Secure` only when the explicit local development HTTP mode is configured.

Production mode uses the `__Host-kunai_session` cookie name and requires an HTTPS `NUXT_APP_ORIGIN`. Local development HTTP mode uses `kunai_session` and requires an HTTP `NUXT_APP_ORIGIN`.

### Server-side PocketBase client boundary

Each request gets a fresh PocketBase SDK client with a fresh `BaseAuthStore`.

There is no mutable global auth store. If a request already has a PocketBase client, the request context rejects reuse with a different auth intent or token.

Nuxt routes use this request-scoped client to call PocketBase as either:

- anonymous, when no session token is required; or
- authenticated with the real user's bearer token, when user-owned data is read or changed.

Normal Phase 0002 user operations do not run as PocketBase superuser and do not use a generic privileged proxy.

### Auth and onboarding flow

Public registration is not part of Phase 0002. Users are administratively provisioned through setup/operations.

Login verifies credentials through PocketBase and sets the application session cookie. Session refresh validates the cookie against PocketBase, rotates the token when PocketBase returns a fresh token, and projects only `SafeSessionDto`.

Onboarding completion runs as the authenticated normal user. It persists the user's profile state, ensures the initial Home seed, and finalizes the completion through the verified normal-user batch path.

The protected Home route reads only the authenticated user's Home seed, validates `owner`, `seedKey`, `name`, and `sortOrder`, and returns the minimal DTO:

```ts
{
  dashboard: { id: string, name: 'Home' },
  initialized: true
}
```

It does not repair, create, or expose widgets, layout, tabs, edit mode, settings, provider data, PocketBase internals, or other users' data.

### Request protection and failure semantics

Unsafe mutations require same-origin validation. Requests with missing, null, malformed, cross-origin, or cross-site origin metadata are rejected before login, logout, or onboarding mutations proceed.

Session and private endpoints use `Cache-Control: private, no-store`.

Invalid or expired sessions are treated as unauthenticated: the local application session cookie is cleared and the client receives a safe unauthenticated/null-session response. PocketBase outage is not treated as invalid authentication: outage returns an unavailable error and does not clear a valid cookie.

Errors returned to the browser are sanitized and do not include bearer tokens, raw PocketBase errors, SQL/filter details, or secrets.

## Consequences

- Browser JavaScript cannot deliberately read the PocketBase bearer token from the application API.
- The Nuxt server is the only Phase 0002 code path that uses the PocketBase bearer token after login.
- Owner isolation is enforced twice: by Nuxt projections/checks and by PocketBase collection rules.
- Normal user CRUD remains auditable against the real user's identity in PocketBase.
- SSR can decide between login, onboarding, Home, and unavailable states without serializing the bearer token.
- Stateless logout removes the application cookie and clears the request-local auth store, but does not globally revoke every PocketBase token that may exist elsewhere.
- HTTPS deployment correctness depends on configuring the production secure mode and a real HTTPS origin.

## Limitations

- Logout is application-local and stateless: it clears the browser's application session cookie. It is not a global logout across all devices or previously issued PocketBase tokens.
- There is no centralized session registry or remote token revocation layer in Phase 0002.
- There is no public registration flow.
- Setup/operations may use administrative provisioning, but ordinary runtime user operations do not use superuser authority.
- A real HTTPS/reverse-proxy deployment was not available during Phase 0002 manual validation. Secure-cookie, forwarded-proto, host/origin, same-origin, login, session, onboarding, and logout behavior behind the real proxy remain pending for Hardening/Release.
- The browser does not directly use its PocketBase token; future direct browser PocketBase SDK access would require a new accepted decision.

## Alternatives

### PocketBase SDK directly in browser

Not selected for Phase 0002.

Direct browser SDK use would make the browser responsible for holding and using the PocketBase bearer token. That would simplify some data access paths, but it would weaken the server-owned boundary, make token exposure harder to reason about, and conflict with the verified `SafeSessionDto` projection model. It can be reconsidered only with a new security review and explicit product/architecture decision.

### Store the token in localStorage or sessionStorage

Rejected for Phase 0002.

Web storage would make the bearer token readable by browser JavaScript. The implemented and verified design keeps the token in an `HttpOnly` cookie and confirms it is absent from `document.cookie`, localStorage, sessionStorage, SSR HTML, Nuxt payload, visible markup, and public runtime config.

### Global mutable PocketBase auth store on the server

Rejected for Phase 0002.

A global mutable auth store risks cross-request identity bleed. The implementation uses a fresh `BaseAuthStore` per request and rejects request-context reuse with a different auth intent or token. Tests cover cross-request identity isolation.

### Generic privileged proxy or superuser runtime

Rejected for ordinary Phase 0002 runtime.

A privileged proxy would bypass normal PocketBase rule enforcement and make owner isolation depend primarily on Nuxt code. Phase 0002 instead performs user-owned reads and writes under the normal user's token, with PocketBase rules as defense in depth. Administrative provisioning remains an operational/setup concern, not a normal runtime data-access path.

### Independent server-side session store

Not selected for Phase 0002.

A separate Nuxt session database could support centralized revocation and richer device/session management, but it would add persistence, expiry, and migration responsibilities beyond the approved Phase 0002 scope. PocketBase remains the identity source and the Nuxt cookie carries the PocketBase bearer token server-side only.

### Centralized revocation layer

Deferred.

Centralized revocation could support global logout, device management, or immediate invalidation of all issued tokens. Phase 0002 does not implement that layer. The current behavior is intentionally limited to clearing the local application session cookie and relying on PocketBase token validity/expiry for remote validation.

## Security considerations

- The bearer token is never deliberately returned in JSON, HTML, Nuxt payload, runtime public config, visible markup, or browser storage.
- `SafeSessionDto` contains only `id`, `displayName`, `avatarKey`, and `onboardingCompleted`.
- Session cookies are `HttpOnly`, `SameSite=Lax`, host-only, and secure in production HTTPS mode.
- Login, logout, and onboarding completion enforce same-origin checks for unsafe requests.
- Session, onboarding, and Home responses use `Cache-Control: private, no-store`.
- Invalid sessions clear only the local application session cookie; outages preserve a valid cookie and report temporary unavailability.
- PocketBase owner rules enforce user isolation for profiles, preferences, dashboards, and dashboard widgets.
- The Home route validates the returned seed record before projecting a minimal DTO.
- Errors are sanitized before reaching the browser.

## Operational/deployment considerations

Production deployment must configure:

- a valid `NUXT_POCKETBASE_URL` reachable by the Nuxt server;
- an HTTPS `NUXT_APP_ORIGIN`;
- secure session cookie mode;
- PocketBase batch API enabled with enough `maxRequests` for onboarding completion;
- reviewed PocketBase migrations and hooks applied from `pb_migrations/` and `pb_hooks/`.

Local development may explicitly use HTTP session cookie mode with an HTTP app origin. That mode is for local development only and must not be used to claim production secure-cookie behavior.

Real HTTPS/reverse-proxy validation is still pending for Hardening/Release. Do not weaken cookie, same-origin, forwarded-proto, or proxy security configuration to make local HTTP behave like production HTTPS.

## Validation/evidence

Implementation references:

- `server/utils/session.ts` — session projection, cookie set/clear, login, refresh, logout, invalid/outage behavior;
- `server/utils/session-config.ts` — secure vs development HTTP cookie modes and cookie names;
- `server/utils/pocketbase-client.ts` — request-scoped PocketBase client and fresh `BaseAuthStore`;
- `server/utils/same-origin.ts` — same-origin validation;
- `server/api/auth/login.post.ts` — login boundary;
- `server/api/auth/session.get.ts` — session refresh endpoint and no-store behavior;
- `server/api/auth/logout.post.ts` — stateless application logout;
- `server/api/onboarding/complete.post.ts` and `server/utils/onboarding.ts` — normal-user onboarding completion and Home seed;
- `server/api/home.get.ts` — protected Home DTO and real PocketBase filter;
- `pb_migrations/20260911180000_auth_onboarding.js` and `pb_hooks/auth_onboarding.pb.js` — owner rules and onboarding completion hook.

Automated evidence:

- `tests/server/auth-session-boundary.test.ts`;
- `tests/server/auth-routes-h3.test.ts`;
- `tests/server/onboarding-complete.test.ts`;
- `tests/server/home.test.ts`;
- `tests/server/security.test.ts`;
- `tests/ssr/auth-routing.integration.nuxt.test.ts`;
- `tests/ssr/security.test.ts`;
- `tests/integration/pocketbase/schema-owner-isolation.test.ts`;
- `tests/integration/pocketbase/isolation/auth-onboarding.test.ts`;
- `tests/integration/pocketbase/onboarding-concurrency.test.ts`;
- `tests/integration/pocketbase/onboarding-seed.test.ts`;
- `tests/integration/pocketbase/home-route.test.ts`.

Manual and OpenSpec evidence:

- `openspec/changes/phase-0002-auth-onboarding/manual-browser-validation-evidence.md`;
- `openspec/changes/phase-0002-auth-onboarding/auth-session-boundary-evidence.md`;
- `openspec/changes/phase-0002-auth-onboarding/schema-owner-isolation-evidence.md`;
- `openspec/changes/phase-0002-auth-onboarding/checkpoint-4b-evidence.md`;
- `openspec/changes/phase-0002-auth-onboarding/tasks.md`.

Verified command evidence for the blocker fix and manual-validation closure included focused Home/security/PocketBase suites, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `git diff --check`.
