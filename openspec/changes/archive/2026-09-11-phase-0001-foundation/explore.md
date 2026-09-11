# Explore — Phase 0001 Foundation

## Scope and sources

- Change: `phase-0001-foundation`
- Artifact store: OpenSpec
- Phase brief: `docs/phases/0001-foundation.md`
- Read: project context/rules/decisions, architecture and security guidance, Phase 0001 brief, relevant ADRs, UX visual/responsive guidance, OpenSpec configuration, and the later phase briefs.

## Current repository state

This is a documentation and SDD handoff repository, not an initialized application. Repository inventory shows product/project documentation, OpenSpec configuration, Git metadata, Pi runtime metadata, and `.gitignore`; it contains no application source or package/tooling files.

Absent application foundation evidence includes:

- `package.json`, `pnpm-lock.yaml`, and pnpm workspace configuration;
- Nuxt configuration, `app/`, `server/`, or `shared/` source directories;
- TypeScript, Tailwind, lint, test, build, or editor configuration;
- PocketBase executable/configuration, migrations, hooks, schemas, or runtime data;
- `.env.example` and application runtime configuration;
- active OpenSpec change directory for this change.

Existing foundation-relevant repository assets are:

- accepted stack ADR: Nuxt 4, Vue 3, TypeScript, Tailwind CSS 4, PocketBase, and pnpm (`docs/decisions/0001-stack.md`);
- target repository-shape guidance, which is directional rather than an existing implementation (`docs/architecture/repository-shape.md`);
- environment and secret-boundary rules (`docs/architecture/configuration.md`, `docs/architecture/security.md`, and ADR 0007);
- terminal-inspired dark-first visual direction and the required dark/light/system modes (`docs/ux/visual-direction.md`);
- `.gitignore`, already excluding dependencies/build artifacts, environment files except `.env.example`, PocketBase `pb_data/`, coverage, logs, and editor/OS noise;
- OpenSpec configured as the authoritative SDD store with strict TDD currently disabled because no runner exists (`openspec/config.yaml`).

The initial repository map did not contain `.codegraph/`, and no CodeGraph MCP or CLI execution capability was available in this executor. The repository-state assessment therefore used the available read-only filesystem inventory after the CodeGraph check could not be performed.

## Foundation work that Phase 0001 must create

Phase 0001 should establish only the smallest conventional single Nuxt application and the tooling needed to develop it safely:

1. Nuxt 4/Vue 3 strict TypeScript project initialization managed by pnpm, with documented install, development, lint, typecheck, test, and build commands.
2. Tailwind CSS 4 baseline and a small terminal/TUI-inspired token system: mostly monospaced typography, flat dark-first surfaces, thin borders, restrained color, compact controls, and reduced reliance on shadow/decoration.
3. Theme infrastructure that supports `dark`, `light`, and `system`, defaults to dark, and can be represented by a minimal non-product shell.
4. A minimal application shell/placeholders that prove the Nuxt UI and theme baseline work without encoding dashboard navigation, dashboard data, widgets, or onboarding UX.
5. One centralized PocketBase endpoint/client or data-access configuration boundary, with no ad-hoc component clients and no authentication/session behavior yet.
6. Runtime configuration that keeps the PocketBase endpoint intentionally public only if required by the client boundary; keeps server-only secrets private; documents variables; and adds `.env.example` once application configuration exists.
7. Local development documentation for Nuxt and the expected local PocketBase endpoint/workflow.
8. A documented, version-controlled PocketBase migration strategy for future schema changes. No schema/migration is required unless the selected setup genuinely needs one.
9. A minimal test runner/baseline appropriate to the chosen Nuxt setup, followed by an OpenSpec testing-capability refresh so later phases can apply strict TDD where supported.

## Constraints that shape the foundation

- Keep one conventional Nuxt repository; do not introduce a monorepo, major UI framework, state manager, grid framework, or provider SDK without a phase-specific need and owner approval.
- PocketBase is the persistent auth/data backend, but Phase 0001 must only prepare its centralized connection/configuration boundary.
- Public runtime configuration must contain only intentionally public values. Never expose PocketBase superuser credentials, encryption keys, OAuth secrets/tokens, AI credentials, or provider secrets.
- Future user-owned records require PocketBase owner rules and app-layer authenticated-owner handling; this phase must not imply that UI hiding is authorization.
- Future external providers must be normalized behind explicit adapters and server boundaries when sensitive; no adapter, provider selection, caching policy, or integration implementation belongs here.
- Exact breakpoints, mobile columns, dashboard layout behavior, widget legal sizes, and PocketBase/Nuxt session strategy remain later-phase decisions and are not blockers for Phase 0001.

## Explicitly excluded from this change

The following must remain absent except for neutral visual placeholders that carry no product behavior:

- Phase 0002: login/logout, user/session persistence, account provisioning, onboarding, avatar selection, location/geolocation, owner rules/collections, and default Home/default-widget seeding.
- Phase 0003: dashboard records, tabs, create/rename/reorder/remove behavior, active-dashboard behavior, and settings navigation.
- Phase 0004: widget registry, widget type contracts, add/catalog UI, layouts, grid, drag/resize/edit mode, device layout persistence, breakpoint and collision decisions.
- Phase 0005: Search, Clock, Weather, Bookmarks, Scratchpad, default search engines, bookmark data, weather provider selection, and all real widget behavior.
- Phase 0006: currency and markets data, watchlists, finance providers, refresh/caching policies, and finance widgets.
- Phase 0007: Google OAuth, calendar data/UI, calendar settings, and token storage/refresh behavior.
- Phase 0008: Travel widgets, AI translation, Japanese holidays, AI provider selection, user credential storage, and Travel dashboard creation.
- Phase 0009: Color Converter, Password Generator, and any other developer tool.
- Phase 0010: production hardening/release work beyond establishing baseline automated commands; no PWA/offline scope.
- All product non-goals: collaboration/workspaces/teams, project/task/time tools, email/chat, monitoring, internal/universal/AI search, full notes, train/events/itinerary tools, browser extension, native apps, and PWA/offline support.

## Risks and decisions

- **Tooling selection risk:** exact package versions and the Nuxt-compatible lint/test setup are not specified. Select the smallest maintained configuration compatible with Nuxt 4, document it, and validate every required command; no owner decision is currently blocking.
- **PocketBase local workflow risk:** the repository contains neither PocketBase runtime nor schema. The phase must clearly document how the endpoint is supplied and how local PocketBase is expected to run, without creating user schema/auth behavior early.
- **Runtime-config risk:** PocketBase endpoint exposure must be deliberately classified as public configuration; all administrative and secret values must remain server-only and absent from `.env.example` values beyond safe placeholders.
- **Scope-creep risk:** a foundation shell can accidentally become dashboard, auth, settings, or widget implementation. Placeholder text/components must remain behavior-free and neutral.
- **Testing transition risk:** no runner currently exists, so strict TDD is disabled. Phase 0001 needs an executable baseline and must refresh the OpenSpec capability configuration afterward.

## Proposal handoff

The proposal should frame this as a new application bootstrap, not a modification of existing app code. It should commit to validated tooling and a neutral themed shell, explicitly list the central PocketBase/runtime-config boundary and migration strategy decision, and retain every product feature for its scheduled later phase.
