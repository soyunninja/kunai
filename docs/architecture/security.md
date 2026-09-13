# Security Architecture

## Threat priorities

The MVP must protect against:

1. cross-user data exposure;
2. browser exposure of server secrets and bearer tokens;
3. insecure provider credential storage;
4. unsafe OAuth token handling;
5. malicious/invalid stored URLs and search templates;
6. corrupted widget configuration/layout crashing the app.

## User isolation

PocketBase rules are mandatory for user-owned collections.

Application code must query within the authenticated owner context. Phase 0002 normal user operations use the real user's PocketBase bearer token through a Nuxt server route and a request-scoped PocketBase SDK client.

Never fetch all users' records and filter in the browser. Never use a shared PocketBase superuser/admin token as the normal runtime path for user-owned data.

## Nuxt/PocketBase session boundary

Phase 0002 follows [ADR 0009](../decisions/0009-nuxt-pocketbase-session-boundary.md): Nuxt owns the browser session boundary while PocketBase remains the identity and data-rule authority.

The PocketBase bearer token is available only to server-side Nuxt code through:

- the `HttpOnly` application session cookie received by the server; and
- a fresh request-scoped PocketBase `BaseAuthStore`/SDK client created for the current request.

The token is not deliberately returned in JSON, HTML, Nuxt payload, public runtime config, visible markup, `document.cookie`, localStorage, or sessionStorage.

The client-visible session projection is only `SafeSessionDto`:

```ts
{
  id: string
  displayName: string
  avatarKey: string
  onboardingCompleted: boolean
}
```

It contains no bearer token, email, raw PocketBase auth payload, or collection metadata.

## Session cookies

Application session cookies are:

- `HttpOnly`;
- `SameSite=Lax`;
- path-scoped to `/`;
- host-only by omitting a `Domain` attribute;
- `Secure` in production HTTPS mode;
- non-`Secure` only in explicit local `development-http` mode.

Production secure mode uses `__Host-kunai_session` and requires an HTTPS `NUXT_APP_ORIGIN`. Local HTTP development uses `kunai_session` and requires `NUXT_SESSION_COOKIE_MODE=development-http` with an HTTP `NUXT_APP_ORIGIN`.

Logout is application-local and stateless: it clears the browser's application session cookie and request-local auth store. It does not globally revoke every PocketBase token that may already exist elsewhere. Phase 0002 has no centralized session registry or global token revocation layer.

Invalid or expired sessions resolve to unauthenticated/null-session behavior and clear the local application cookie. A PocketBase outage returns a temporary unavailable error and preserves a valid cookie because outage is not proof that the session is invalid.

## Same-origin protection

Unsafe auth/onboarding mutations must validate same-origin request metadata before proceeding.

Phase 0002 applies same-origin checks to login, logout, and onboarding completion. Missing, `null`, malformed, cross-origin, or cross-site origin metadata is rejected with sanitized errors.

Production reverse proxies must preserve coherent externally visible Host/Origin behavior and forwarded protocol information so the configured `NUXT_APP_ORIGIN` and Secure cookie behavior match the real HTTPS deployment.

## Cache and error handling

Session, onboarding, and Home responses use `Cache-Control: private, no-store`.

Browser-facing errors are sanitized. Do not include bearer tokens, passwords, raw PocketBase errors, raw filters, database dumps, or internal headers in logs or troubleshooting material.

`401` means the request is unauthenticated or the local session has been cleared. `503` means the dependency is temporarily unavailable or the session/Home state could not be checked safely.

## Account provisioning and administration

Public registration is not implemented in Phase 0002. Users are provisioned administratively before login.

PocketBase superuser/admin credentials belong only to setup and operational administration. They must never be exposed in public runtime config, client bundles, `.env.example`, documentation examples, or browser code.

## Sensitive collections

AI credentials and OAuth secrets/tokens must not be readable through normal browser-side PocketBase rules.

Trusted Nuxt server code performs operations requiring those records.

## AI credentials at rest

If provider credentials are persisted, encrypt them before storage using an application encryption key stored in server environment configuration.

Do not store the encryption key in PocketBase.

Do not return decrypted credentials to the client.

## URLs

Bookmark URLs and search engine URL templates are user-controlled input.

Validate expected protocols and safely encode user queries.

Do not execute arbitrary JavaScript URL schemes.

## Password Generator

- use browser cryptographic randomness;
- do not call server;
- do not log generated passwords;
- do not persist them;
- avoid analytics payloads containing them.

## Logging

Never log:

- passwords;
- auth tokens;
- AI keys;
- OAuth refresh/access tokens;
- generated passwords;
- decrypted secrets.

## External content

Provider strings are data, not trusted markup.

Do not render provider/user data as unsanitized HTML.

## HTTPS and reverse proxy status

Production requires HTTPS, Secure cookies, a correct `NUXT_APP_ORIGIN`, same-origin protection, and coherent Host/Origin/protocol forwarding through any reverse proxy.

Real HTTPS/reverse-proxy validation remains PENDING for Hardening/Release because no real deployment was available during Phase 0002 manual validation. Do not weaken cookie or same-origin configuration to make local HTTP behave like production HTTPS.
