# PocketBase Foundation Specification

## Purpose

Create a documented, secure, server-side local PocketBase configuration validation boundary that prepares later work without deciding authentication or ordinary user-data access.

## Requirements

### Requirement: Server-side PocketBase configuration validation boundary

The application MUST define one small, consistent server-side boundary that validates and exposes the configured PocketBase endpoint to Foundation-owned server code. The boundary MUST perform no network I/O and MUST NOT require the PocketBase SDK. It does not select the definitive Nuxt/PocketBase client/server access strategy: authentication, session handling, and ordinary user-data access are deferred to Phase 0002. Any future operation requiring secrets, credentials, or privileged access MUST remain server-side.

#### Scenario: Server startup receives a valid endpoint configuration

- GIVEN the application is started with a syntactically valid configured endpoint
- WHEN the Foundation server-side configuration boundary initializes
- THEN it exposes a normalized endpoint configuration without contacting PocketBase

#### Scenario: Phase 0002 selects an access strategy

- GIVEN Phase 0002 is ready to implement authentication or ordinary user-data access
- WHEN it chooses the Nuxt/PocketBase access strategy
- THEN it may use the Foundation configuration validation boundary without treating that boundary as a decision that all PocketBase access is server-side

### Requirement: Explicit runtime configuration and secret boundary

The foundation MUST define and document its environment-variable strategy. Once application runtime configuration exists, the repository MUST include a safe `.env.example` that documents required values without containing usable secrets. A PocketBase endpoint MUST NOT be exposed through public runtime configuration in Phase 0001 unless the Foundation implementation proves a specific need and documents the classification and rationale. Any later browser/client exposure belongs to the Phase 0002 access-strategy decision. Administrative credentials, encryption keys, OAuth secrets or tokens, provider credentials, and other server-only secrets MUST NOT be committed, included in public runtime configuration or browser bundles, or logged.

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

The migration strategy is planning guidance only. It does not require a Phase 0001 schema, collection, owner rule, or migration.
