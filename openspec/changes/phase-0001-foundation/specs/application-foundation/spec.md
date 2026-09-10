# Application Foundation Specification

## Purpose

Provide a reproducible, quality-checked Nuxt application foundation for later product phases without introducing dashboard or account behavior.

## Requirements

### Requirement: Accepted application stack

The repository MUST provide one conventional application foundation using Nuxt 4, Vue 3, strict TypeScript, Tailwind CSS 4, and pnpm. Dependency resolution MUST be reproducible from the version-controlled repository state. The foundation MUST NOT introduce a monorepo, major UI framework, state-management framework, grid framework, provider SDK, or replacement for an accepted stack technology.

#### Scenario: A maintainer prepares a clean checkout

- GIVEN a clean checkout with the documented runtime and package-manager prerequisites installed
- WHEN the maintainer follows the documented pnpm installation workflow
- THEN dependencies resolve from version-controlled metadata and the Nuxt application is ready to run locally

#### Scenario: A proposed convenience dependency expands the foundation

- GIVEN a dependency would add a major UI, state-management, grid, or provider framework
- WHEN it has no demonstrated Phase 0001 requirement
- THEN the foundation MUST NOT add that dependency

### Requirement: Executable development and quality workflow

The repository MUST document and expose runnable workflows for installation, local development, linting, strict type checking, testing, and production building. The development workflow MUST start the Nuxt application locally, and the production workflow MUST produce a production build. Each quality command MUST perform its stated check; the test command MUST execute meaningful foundation checks rather than succeed solely because no tests are selected.

#### Scenario: A maintainer verifies the foundation

- GIVEN dependencies are installed and required local configuration is supplied
- WHEN the maintainer runs each documented development and quality workflow
- THEN development starts locally and lint, strict type checking, tests, and production build each complete successfully

#### Scenario: A foundation behavior regresses

- GIVEN a checkable foundation behavior such as runtime configuration handling or theme selection is broken
- WHEN the test workflow runs
- THEN at least one meaningful foundation test MUST fail

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

### Requirement: Deferred product behavior remains absent

The foundation MUST provide only neutral application placeholders and MUST NOT implement authentication, account provisioning, onboarding, persisted preferences, dashboard records or navigation, widget registry or behavior, layouts or grid interactions, Settings, external providers, or product data. It MUST NOT seed Home, Travel, Dev, widgets, users, collections, or product records.

#### Scenario: A maintainer opens the foundation shell

- GIVEN the Phase 0001 application is running
- WHEN the maintainer inspects available UI and application behavior
- THEN it presents only neutral foundation content and no dashboard, account, Settings, widget, or provider feature is available
