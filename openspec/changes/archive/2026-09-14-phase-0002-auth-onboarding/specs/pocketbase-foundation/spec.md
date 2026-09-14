# Delta for PocketBase Foundation

## ADDED Requirements

### Requirement: Owner-scoped onboarding persistence and direct API isolation

The system MUST maintain owner-scoped `user_preferences`, `dashboards`, and `dashboard_widgets` records needed for onboarding. Each normal user-owned record MUST have an owner relation. PocketBase list, view, create, update, and delete authorization MUST independently restrict each record to its authenticated owner. A client-supplied owner value MUST NOT authorize creation or reassignment. A widget's dashboard relation MUST belong to the same authenticated owner, including relation changes. Normal browser operations MUST use the authenticated user's PocketBase identity, not PocketBase superuser credentials.

#### Scenario: Attempt to access another user's data

- GIVEN two normal authenticated users, User A and User B, each have private owner-scoped records
- WHEN User A uses the normal PocketBase API with User A's credential to list, view, create against, update, or delete User B's records
- THEN PocketBase denies every cross-user operation and User B's records remain unchanged

#### Scenario: Forged owner

- GIVEN User A submits creation or update input naming User B as owner
- WHEN the system processes the request through its normal application boundary or direct normal PocketBase API
- THEN the request cannot create or reassign a record to User B and no unauthorized record is persisted

#### Scenario: Forged dashboard relation

- GIVEN User A submits a widget creation or update referencing a dashboard owned by User B
- WHEN the system processes the request through its normal application boundary or direct normal PocketBase API
- THEN the operation is denied and no cross-owner widget relationship is persisted

#### Scenario: Cross-user rule verification

- GIVEN two normal provisioned users and the owner-scoped onboarding collections
- WHEN list, view, create, update, and delete behavior is verified for each user against the other user's records
- THEN the verification demonstrates isolation for every operation without using a privileged administrative credential

## MODIFIED Requirements

### Requirement: Server-side PocketBase configuration validation boundary

The application MUST define one small, consistent server-side boundary that validates and exposes the configured PocketBase endpoint to application server code. The boundary MUST perform no configuration-validation network I/O. Phase 0002 MUST use the endpoint only through a server-owned authentication and normal-user data-access boundary: each request evaluates a request-isolated PocketBase identity from the application session, and normal browser data operations do not expose the endpoint or PocketBase credential to browser code. Operations requiring secrets, credentials, or privileged access MUST remain server-side.

(Previously: The Foundation boundary did not select the definitive Nuxt/PocketBase client/server access strategy, and browser/client exposure was deferred to Phase 0002.)

#### Scenario: Server startup receives a valid endpoint configuration

- GIVEN the application is started with a syntactically valid configured endpoint
- WHEN the server-side configuration boundary initializes
- THEN it exposes a normalized endpoint configuration without contacting PocketBase

#### Scenario: A protected request uses PocketBase

- GIVEN an authenticated request needs normal user data
- WHEN the application accesses PocketBase
- THEN it does so through the server-owned, request-isolated boundary using the authenticated user's identity

### Requirement: Explicit runtime configuration and secret boundary

The foundation MUST define and document its environment-variable strategy. Once application runtime configuration exists, the repository MUST include a safe `.env.example` that documents required values without containing usable secrets. The PocketBase endpoint and all PocketBase bearer credentials MUST remain absent from public runtime configuration and browser bundles. Administrative credentials, encryption keys, OAuth secrets or tokens, provider credentials, and other server-only secrets MUST NOT be committed, included in public runtime configuration or browser bundles, or logged.

(Previously: Any browser/client exposure of the private PocketBase endpoint was deferred to the Phase 0002 access-strategy decision.)

#### Scenario: A maintainer configures a local endpoint

- GIVEN the maintainer follows the local setup documentation
- WHEN the maintainer supplies the required endpoint configuration
- THEN the application receives the documented endpoint through the centralized server boundary and no browser-facing configuration exposes it

#### Scenario: Sensitive configuration is reviewed

- GIVEN the repository, public runtime configuration, browser-facing configuration, and application logs are inspected
- WHEN PocketBase and other secret-bearing values are checked
- THEN no endpoint, bearer credential, administrative credential, or provider secret is present in public configuration, browser output, examples, committed configuration, or logs
