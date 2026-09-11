# Application Foundation Specification

## Purpose

Provide a reproducible, quality-checked Nuxt application foundation for later product phases without introducing dashboard or account behavior.

## Requirements

### Requirement: Accepted application stack

The repository MUST provide one conventional application foundation using Nuxt 4, Vue 3, strict TypeScript, Tailwind CSS 4, and pnpm. Dependency resolution MUST be reproducible from the version-controlled repository state. The foundation MUST NOT introduce a monorepo, major UI framework, state-management framework, grid framework, or replacement for an accepted stack technology. It MUST NOT add the PocketBase SDK unless a demonstrated Foundation requirement makes it necessary.

#### Scenario: A maintainer prepares a clean checkout

- GIVEN a clean checkout with the documented runtime and package-manager prerequisites installed
- WHEN the maintainer follows the documented pnpm installation workflow
- THEN dependencies resolve from version-controlled metadata and the Nuxt application is ready to run locally

#### Scenario: A proposed convenience dependency expands the foundation

- GIVEN a dependency would add a major UI, state-management, grid, or provider framework
- WHEN it has no demonstrated Phase 0001 requirement
- THEN the foundation MUST NOT add that dependency

### Requirement: Executable development and quality workflow

The repository MUST document and expose runnable workflows for installation, local development, linting, strict type checking, testing, and production building. The development workflow MUST start the Nuxt application locally, and the production workflow MUST produce a production build. Each quality command MUST perform its stated check; the test command MUST execute meaningful checks for behavior implemented by Phase 0001 rather than succeed solely because no tests are selected.

#### Scenario: A maintainer verifies the foundation

- GIVEN dependencies are installed and required local configuration is supplied
- WHEN the maintainer runs each documented development and quality workflow
- THEN development starts locally and lint, strict type checking, tests, and production build each complete successfully

#### Scenario: An implemented foundation behavior regresses

- GIVEN an implemented Phase 0001 behavior such as runtime configuration handling or theme selection is broken
- WHEN the test workflow runs
- THEN at least one meaningful foundation test MUST fail for that implemented behavior

### Requirement: Testing capability record

After the selected test baseline has been implemented and its workflow has been verified, the OpenSpec testing capability configuration MUST record the supported runner and command so later phases can apply strict TDD using verified capability. The record MUST NOT claim a runner, command, or strict-TDD capability that has not been verified.

#### Scenario: The verified test baseline is available

- GIVEN the foundation test workflow has completed successfully against meaningful checks
- WHEN Phase 0001 records its verified SDD state
- THEN the testing capability configuration identifies the verified test command and enables strict TDD only to the extent supported by that baseline

#### Scenario: Test tooling is unavailable or failing

- GIVEN the selected test workflow cannot be executed successfully
- WHEN the SDD capability state is recorded
- THEN it MUST NOT be represented as a verified strict-TDD capability

### Requirement: Neutral foundation shell

The foundation MUST render a neutral application shell that demonstrates the implemented visual baseline without product-domain content. The shell MUST include a main landmark, a concise foundation heading and explanatory text, and the non-persistent appearance control defined by the visual-foundation specification.

#### Scenario: A maintainer opens the foundation shell

- GIVEN the Phase 0001 application is running
- WHEN the maintainer opens the root shell
- THEN it renders the foundation heading, explanatory text, main landmark, and appearance control

Deferred product scope is controlled by the change proposal, specifications, design, and tasks. Tests in this phase cover only implemented foundation behavior.
