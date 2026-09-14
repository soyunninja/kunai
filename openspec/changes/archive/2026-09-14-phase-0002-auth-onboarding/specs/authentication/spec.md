# Authentication Specification

## Purpose

Provide private email/password authentication and server-owned session behavior for administratively provisioned users.

## Requirements

### Requirement: Administratively provisioned email/password authentication

The system MUST authenticate provisioned `users` accounts by email and password. It MUST provide login and logout. Public registration, social login, password reset, and email-verification user experiences or APIs MUST NOT be provided in this phase.

#### Scenario: Successful login

- GIVEN an administratively provisioned user submits valid email and password credentials
- WHEN the system authenticates the user
- THEN it establishes a private session and routes the user according to that user's onboarding state

#### Scenario: Invalid login

- GIVEN a visitor submits invalid or incomplete login credentials
- WHEN authentication fails
- THEN the visitor remains unauthenticated and receives recoverable error feedback without credential disclosure

#### Scenario: Logout

- GIVEN an authenticated user has an active session
- WHEN the user logs out
- THEN the system ends the application session, clears its session cookie, and routes the user to login without returning a bearer token

### Requirement: Protected navigation and session restoration

The system MUST restore a valid authenticated session during SSR refresh and subsequent navigation. It MUST route unauthenticated access to protected application routes to login, route authenticated users with incomplete onboarding to onboarding, and route authenticated users with completed onboarding to their protected Home landing. Protected state MUST NOT render before the applicable session and onboarding state are resolved.

#### Scenario: SSR refresh

- GIVEN a user has a valid session cookie and completed onboarding
- WHEN the user refreshes a protected route through SSR
- THEN the protected Home landing is rendered for that user without requiring a new login

#### Scenario: User without onboarding

- GIVEN an authenticated user has not completed onboarding
- WHEN the user opens or navigates to a protected application route
- THEN the system routes the user to onboarding rather than the protected Home landing

#### Scenario: User with completed onboarding

- GIVEN an authenticated user has completed onboarding
- WHEN the user opens or navigates to a protected application route
- THEN the system routes the user to the protected Home landing rather than onboarding

#### Scenario: Unauthenticated redirect

- GIVEN no valid authenticated session is present
- WHEN a visitor requests a protected route through SSR or client navigation
- THEN the system routes the visitor to login and does not render protected user data

### Requirement: Invalid and expired session handling

The system MUST validate the session against PocketBase as needed to determine whether it remains valid. When validation or refresh establishes that a session is invalid or expired, the system MUST clear the application session cookie, treat the request as unauthenticated, and MUST NOT expose protected state or stale identity data.

#### Scenario: Expired session

- GIVEN a session cookie contains an expired PocketBase credential
- WHEN the user refreshes or makes a protected request
- THEN the system clears the cookie and routes the user to login without rendering protected state

#### Scenario: Invalid session

- GIVEN a session cookie contains a credential that cannot establish a valid user session
- WHEN the system evaluates a protected request
- THEN it treats the request as unauthenticated and does not disclose whether the credential belonged to an account

### Requirement: Server-owned bearer credential

The PocketBase bearer credential MUST be held only in an application session cookie and MUST NOT be accessible to browser JavaScript. The cookie MUST be host-only, scoped to `/`, `HttpOnly`, and `SameSite=Lax`; it MUST be `Secure` in HTTPS production. Development cookie behavior MUST be explicitly configured and MUST NOT silently weaken the production cookie contract. Tokens and raw authentication payloads MUST NOT appear in browser-readable state, response bodies, public runtime configuration, logs, or client-side SDK storage.

#### Scenario: Browser session inspection

- GIVEN an authenticated browser session
- WHEN browser JavaScript and browser-readable application state are inspected
- THEN no PocketBase bearer credential or raw authentication payload is available

#### Scenario: Production cookie

- GIVEN the application runs over HTTPS in production
- WHEN a successful login establishes a session
- THEN the session cookie is host-only, path-scoped to `/`, HttpOnly, SameSite=Lax, and Secure

#### Scenario: Development cookie configuration

- GIVEN the application runs in its documented development environment
- WHEN a session is established
- THEN its cookie behavior follows explicit development configuration while the production Secure requirement remains unchanged

### Requirement: Safe session representation and request isolation

The system MUST expose to browser code only a serializable session DTO containing the authenticated user's identifier, display name, avatar key, and onboarding state. Each SSR request and protected application API request MUST evaluate authentication with request-isolated state. A mutable process-global authentication or PocketBase client/auth store MUST NOT be used for normal user requests.

#### Scenario: Safe session DTO

- GIVEN an authenticated browser requests session state
- WHEN the system returns session information
- THEN it returns only the permitted session DTO fields and no credential or raw PocketBase auth data

#### Scenario: Simultaneous user requests

- GIVEN two authenticated users make overlapping SSR or protected API requests
- WHEN each request resolves its session
- THEN each request uses its own authenticated identity and receives no state from the other request

### Requirement: Same-origin protection for unsafe operations

The system MUST reject unsafe cookie-authenticated operations unless same-origin request metadata validates the request as originating from the application origin. A rejected request MUST NOT mutate user data or session state.

#### Scenario: Cross-origin unsafe request

- GIVEN a third-party origin attempts an unsafe request using a user's ambient session cookie
- WHEN same-origin request metadata is absent or invalid
- THEN the system rejects the request and performs no mutation

### Requirement: Auth/session architecture decision record

The repository MUST contain a dedicated accepted ADR documenting the Phase 0002 Nuxt/PocketBase server-owned session architecture, its browser-token boundary, request isolation, normal-user PocketBase identity, administrative account provisioning, cookie/deployment prerequisites, logout consequence, and access-rule defense in depth.

#### Scenario: Architecture review

- GIVEN a maintainer reviews the accepted architecture decisions after Phase 0002
- WHEN they inspect the dedicated authentication/session ADR
- THEN it states the approved session boundary and its security and operational consequences
