# PocketBase Foundation Specification

## Purpose

Create a documented, secure, centralized local PocketBase configuration boundary that prepares later data access without creating authentication, schema, or product data.

## Requirements

### Requirement: Centralized PocketBase boundary

The application MUST define one small, consistent PocketBase endpoint and client/data-access configuration boundary. Application components MUST NOT create ad hoc PocketBase clients. The boundary MUST NOT implement authentication, session persistence, privileged service access, collection schemas, user CRUD, or product-record operations; the Nuxt SSR/client session strategy remains deferred to Phase 0002.

#### Scenario: A component needs future PocketBase access

- GIVEN a future application component requires a PocketBase operation
- WHEN the operation is added after Phase 0001
- THEN it can use the centralized boundary rather than constructing a PocketBase client inside the component

#### Scenario: The foundation is inspected for early product behavior

- GIVEN the Phase 0001 foundation is running or reviewed
- WHEN PocketBase-related code and configuration are examined
- THEN no authentication, session, privileged access, schema, user CRUD, or product-record behavior is present

### Requirement: Explicit runtime configuration and secret boundary

The foundation MUST define and document its environment-variable strategy. Once application runtime configuration exists, the repository MUST include a safe `.env.example` that documents required values without containing usable secrets. A PocketBase endpoint MAY be exposed through public runtime configuration only when the selected client boundary requires browser access; its public classification and rationale MUST be explicit. Administrative credentials, encryption keys, OAuth secrets or tokens, provider credentials, and other server-only secrets MUST NOT be committed, included in public runtime configuration or browser bundles, or logged.

#### Scenario: A maintainer configures a local endpoint

- GIVEN the maintainer follows the local setup documentation
- WHEN the maintainer supplies the required endpoint configuration
- THEN the application receives the documented endpoint through the centralized boundary and any public exposure is explicitly classified

#### Scenario: Sensitive configuration is reviewed

- GIVEN the repository, public runtime configuration, and browser-facing configuration are inspected
- WHEN secret-bearing values are checked
- THEN no administrative or provider secret is present in examples, committed configuration, public configuration, browser output, or logs

### Requirement: Local PocketBase setup and failure guidance

The repository MUST document how to run or supply the expected local PocketBase service, configure its endpoint, start the Nuxt application, and verify the foundation. The documentation MUST distinguish Nuxt startup from PocketBase service availability and MUST provide troubleshooting for missing or invalid endpoint configuration and an unavailable local service. Connectivity validation MUST NOT create product records.

#### Scenario: The local service is unavailable

- GIVEN the Nuxt application is configured with an endpoint whose PocketBase service is unavailable
- WHEN a maintainer follows the troubleshooting guidance
- THEN the guidance identifies the service/configuration condition and its corrective action without directing the maintainer to create product data

#### Scenario: Endpoint configuration is missing or invalid

- GIVEN required endpoint configuration is absent or malformed
- WHEN a maintainer follows the setup or troubleshooting documentation
- THEN the documentation identifies the configuration problem and explains how to correct it explicitly

### Requirement: Version-controlled migration strategy

The repository MUST document a version-controlled strategy for future PocketBase schema migrations, including the migration location and application workflow. PocketBase runtime data MUST NOT be committed. Phase 0001 MUST NOT add an initial schema, migration, user collection, or owner rule unless a genuine foundation requirement makes it necessary; any such necessity requires its own explicit specification before implementation.

#### Scenario: A later phase needs a schema change

- GIVEN a later approved phase requires a PocketBase schema change
- WHEN maintainers prepare that change
- THEN repository documentation identifies where its migration belongs and how it is applied under version control

#### Scenario: The foundation repository is reviewed

- GIVEN Phase 0001 has no genuine schema requirement
- WHEN its PocketBase assets are inspected
- THEN no manufactured schema, user collection, owner rule, migration, or committed runtime data is present
