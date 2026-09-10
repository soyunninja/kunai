# Proposal — Phase 0001 Foundation

## Intent

Create the smallest maintainable foundation for the accepted Nuxt/PocketBase stack, not an early implementation of the dashboard product. The exploration describes a documentation-only repository without application code or executable quality tooling. This change gives maintainers a reproducible local application, a restrained visual baseline, and explicit configuration boundaries so subsequent phases can deliver product behavior without first reconstructing the development environment.

The immediate users of this slice are the owner and implementation maintainers. The outcome is a working development foundation, not a usable startup-page MVP.

## Basis and confirmed handoff

Authoritative inputs: `explore.md` in this change; `docs/phases/0001-foundation.md`; `AGENTS.md`; `project/context.md`, `project/rules.md`, `project/product-decisions.md`, and `project/open-decisions.md`; `docs/product/vision.md` and `docs/product/mvp.md`; `docs/architecture/overview.md`, `configuration.md`, `security.md`, and `repository-shape.md`; `docs/decisions/0001-stack.md`; `docs/ux/visual-direction.md`; and `openspec/config.yaml`.

The parent confirmed existing product decisions and that no owner decision blocks this phase. Research was unselected; no external research is required or claimed. No additional product interview or consent is inferred. Later-phase decisions remain deferred, including session strategy, dashboard protection rules, layout breakpoints, widget sizes, and provider selection.

## Scope

1. **Conventional application bootstrap.** Establish one Nuxt 4 application using Vue 3, strict TypeScript, Tailwind CSS 4, and pnpm. Provide package metadata, reproducible dependency resolution, and documented runtime/package-manager prerequisites. Avoid speculative folders, packages, abstractions, and a monorepo.
2. **Executable developer workflow.** Provide install, development, lint, typecheck, test, and production-build workflows appropriate to Nuxt. Introduce the smallest useful test baseline with meaningful foundation checks, not an empty passing command. Refresh OpenSpec testing capabilities after the runner is implemented and verified so subsequent phases can use strict TDD where supported.
3. **Neutral themed shell.** Add minimal application placeholders and reusable base visual tokens: predominantly monospaced typography, flat surfaces, thin borders, compact controls, restrained color, and little or no shadow. Support dark, light, and system appearance with dark as the default. A minimal demonstration control may exercise themes without introducing Settings or persisted account preferences. Preserve basic keyboard accessibility, tablet readability/touch usability, and reduced-motion expectations.
4. **Centralized PocketBase configuration boundary.** Prepare one small, consistent endpoint/client setup boundary. Document the local PocketBase endpoint and how to run or supply the local service. Do not introduce authentication, user CRUD, collection schemas, privileged service access, or component-local clients. Leave the Nuxt SSR/client session strategy to Phase 0002.
5. **Environment and secret discipline.** Define the environment-variable strategy and add `.env.example` when code is introduced. Expose the PocketBase endpoint publicly only if the chosen client boundary requires it; classify that exposure explicitly. Keep all secret values out of public runtime configuration, browser bundles, logs, examples, and source control. Do not add unused provider credential infrastructure.
6. **Local setup and migration guidance.** Document clean-checkout startup, verification commands, environment setup, PocketBase prerequisites, and troubleshooting of missing/invalid endpoint configuration or an unavailable local service. Record a version-controlled strategy for future PocketBase schema migrations, including where migrations live and how they are applied. No initial schema or migration is required without a genuine foundation need; never commit `pb_data/` or manufacture user collections to demonstrate connectivity.

Exact compatible dependency versions, lint/test integration, theme mechanics, and the concrete PocketBase setup belong in design. They must remain small and explicit. No new major UI framework, state manager, grid framework, or external provider choice is proposed.

## Non-goals

- **Phase 0002:** login/logout, session persistence, account provisioning, onboarding, avatars, location/geolocation, user collections/owner rules, and default Home/widget seeding.
- **Phase 0003:** dashboard records, tabs/navigation, dashboard CRUD/reordering, Home lifecycle rules, and Settings UI.
- **Phase 0004:** widget registry/catalog/contracts, grid/layout engine, drag/resize/edit mode, device layout persistence, breakpoint or collision decisions. No registry placeholder is needed unless design demonstrates a structural necessity; it must not implement widget behavior.
- **Phases 0005–0009:** all real widgets, search engines/aliases, bookmarks, notes/scratchpad, weather, finance, Google Calendar/OAuth, Travel, AI credentials/translation, holidays, color conversion, and password generation.
- **Phase 0010:** production deployment/release and broader hardening beyond the foundation quality baseline.
- Collaboration, shared workspaces, projects/tasks/time management, email, monitoring, universal internal search, a command palette, a full notes product, train/event tools, and PWA/offline support.

Home, Travel, and Dev must not become hard-coded shell sections or seeded product data. The future private-user model and dashboard invariants remain unchanged, but are not implemented here.

## Affected areas and impact

| Area | Planned impact |
|---|---|
| Root application/tooling configuration | New Nuxt, TypeScript, Tailwind, pnpm, lint and test baseline; lockfile and safe environment example. |
| Minimal Nuxt UI and styles | Neutral shell and theme tokens only; no product routes or dashboard semantics. |
| PocketBase/runtime configuration | Central endpoint/client setup and explicit public/private classification; no business data migration. |
| Tests | Runnable foundation checks for the selected setup, theme behavior, and configuration boundaries. |
| Development/architecture documentation | Reproducible local workflow and recorded migration strategy. |
| OpenSpec/project tracking | Testing capability refresh after validation; verified context and phase status updates at the appropriate completion gates. |

These are prospective implementation impacts, not edits performed by this proposal phase. This phase writes only the proposal inside the active change directory. There is no existing user-data migration or user-facing compatibility change identified by exploration.

## Risks and mitigations

- **Tooling incompatibility:** choose maintained Nuxt-compatible package versions and prove all documented commands from a clean checkout. Do not substitute the accepted stack to bypass setup difficulties.
- **Secret exposure:** explicitly classify runtime values and verify that only intentionally public configuration reaches the browser. Endpoint configuration must not require superuser credentials.
- **Premature architecture:** keep the PocketBase boundary narrow; avoid selecting auth/session handling or building a generic repository/provider framework before their phases.
- **Local service confusion:** document PocketBase setup separately from Nuxt startup and make configuration problems explicit rather than silently selecting another endpoint. Connectivity validation must not create product records.
- **Theme regressions:** specify and verify dark default, explicit light/dark modes, and system-mode behavior across initial rendering and client interaction; do not turn the demonstration into Settings scope.
- **False testing confidence:** an installed runner alone is insufficient. Require executable checks and recorded verification before updating SDD testing capabilities or reporting completion.
- **Review size:** bootstrapping may exceed the configured 400-line review budget. The parent must assess delivery risk during task planning and honor `ask-on-risk`; this proposal authorizes neither a chain strategy nor a size exception.

## Rollback

Before product data exists, revert the foundation implementation work units to restore the documentation-only baseline. Preserve OpenSpec history and existing product decisions. Keep local environment files and PocketBase runtime data outside version control; do not delete local data as part of rollback. If design establishes a genuinely necessary migration, it must specify its own safe reversal or recovery procedure before implementation. No destructive database rollback is proposed here.

## Success criteria

Phase 0001 is successful when verification demonstrates:

1. A clean checkout installs with the documented pnpm workflow and prerequisites, starts the Nuxt application locally, and produces a production build.
2. Documented lint, strict typecheck, test, and build commands all pass; tests exercise actual foundation behavior.
3. The neutral shell demonstrates dark default plus working light and system modes with the terminal-inspired visual baseline and basic keyboard/touch usability.
4. Local PocketBase startup/endpoint configuration is reproducible, all PocketBase setup is centralized, and endpoint failure/configuration handling is documented without adding auth or product records.
5. Public runtime configuration contains only intentionally public values; no administrative/provider secrets or runtime database data are committed or exposed to client JavaScript.
6. A version-controlled future migration strategy is documented without unnecessary schema creation.
7. No dashboard, auth, widget, Settings, provider, or other later-phase behavior is implemented.
8. OpenSpec testing capabilities reflect the verified runner. Required automated and manual checks have recorded evidence, verification has no unresolved critical blocker, the change is archived, and project context/phase tracking describe verified truth before Phase 0002 begins.

## Next step

Proceed to specification for `phase-0001-foundation`, converting these boundaries and acceptance criteria into testable requirements. Follow with design and tasks; proposal completion is not implementation completion.
