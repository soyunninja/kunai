# Design — Phase 0001 Foundation

## Decision summary

Build one SSR-enabled Nuxt 4 application at the repository root. Use Vue 3, strict TypeScript, Tailwind CSS 4 through its Vite plugin, pnpm, Nuxt ESLint, and Vitest with Nuxt test utilities. Render only a neutral shell with a transient appearance selector. Prepare a server-side PocketBase endpoint configuration and validation boundary without installing its SDK, connecting automatically, or deciding the future authentication or ordinary user-data access strategy.

This document is an implementation plan, not evidence of implemented or verified software. This design phase changes only this file. All paths outside the active change below are prospective apply-phase changes.

## Context and evidence

Inputs read directly: `explore.md`, `proposal.md`, all three capability specifications, `AGENTS.md`, project context/rules/product/open decisions, product vision/MVP, Phase 0001 brief, architecture overview/configuration/security/repository shape, ADRs 0001 and 0007, visual direction, root README, `.gitignore`, and `openspec/config.yaml`.

Exploration reports a documentation-only repository; available root inventory corroborates no application/package baseline. There is no existing application implementation to preserve. CodeGraph and shell execution are unavailable in this executor, so git root confirmation, index initialization, dependency discovery, and commands were not performed. Filesystem reads were the fallback. No compatibility, test, browser, or build success is claimed.

The scope explicitly targets this Nuxt repository, not `packages/coding-agent`. Existing product decisions remain authoritative. Authentication, SSR/client PocketBase access, ordinary user-data access, dashboard rules, widget contracts, breakpoints, and providers remain later-phase decisions. Secret-requiring PocketBase and integration operations remain server-side.

## 1. Application and tooling

### Selected shape

- Keep Nuxt SSR enabled and use `app/app.vue` directly; no pages, layouts, router customization, API routes, or speculative directories.
- Use a private package named `browser-startup-page`; this is an internal identifier, not a branding decision.
- Runtime baseline: Node 24 LTS; pnpm 10. Pin the tested Node patch in `.node-version` and exact pnpm version in `packageManager`; declare Node 24 in `engines`.
- Dependencies: `nuxt` 4 and `vue` 3. Use the Nuxt-compatible Vue version; add `vue-router` only if required by the selected Nuxt baseline.
- Development tooling: `typescript`, `vue-tsc`, `tailwindcss` 4, `@tailwindcss/vite` 4, `@nuxt/eslint`, `eslint`, `vitest`, `@nuxt/test-utils`, `@vue/test-utils`, and `happy-dom`.
- Configure Tailwind using `@tailwindcss/vite` in `nuxt.config.ts`, with `@import "tailwindcss"` in the global CSS entry. No legacy Tailwind module, PostCSS setup, or Tailwind configuration file unless the resolved integration actually requires it.
- Configure `@nuxt/eslint` and extend its generated flat configuration from `eslint.config.mjs`. Use its supported TypeScript/Vue rules, reject explicit `any` and TypeScript suppression comments, and ignore generated output. No separate formatter or competing style tool.
- Use Nuxt 4's generated TypeScript project references for app/server/shared/node contexts; preserve `strict: true`. Include tests and tooling in type checking through the appropriate project configuration. Do not replace Nuxt's generated types with handwritten aliases or shim away failures.
- Vitest uses `defineVitestConfig` from `@nuxt/test-utils/config` and the Nuxt test environment with happy-dom for component/head integration. Pure endpoint tests use the node environment override. No Playwright installation or browser automation infrastructure is necessary for this foundation; browser verification remains explicit and manual.

### Dependency resolution gate

Exact compatible package patches are not established by repository evidence or this tool-limited design session. Do not copy an unverified version matrix or use floating `latest` in committed metadata. During the first implementation work unit, resolve maintained versions within the selected stack majors and compatible peer ranges, pin direct dependencies exactly, commit `pnpm-lock.yaml`, and record the resolved version table plus Node/pnpm versions in local-development documentation. Select Vitest, ESLint, TypeScript, and test-utils versions together from their actual peer constraints, rather than forcing unrelated newest majors.

A frozen install and all checks below must prove that matrix before subsequent implementation depends on it. An incompatible patch or tooling peer correction is an implementation adjustment; changing the accepted stack or adding a major framework requires a design/approval revisit. Dependency compatibility remains a verification risk, not a claimed completed decision.

### Package scripts

| Script | Command | Contract |
|---|---|---|
| `postinstall` | `nuxt prepare` | Generate Nuxt types and ESLint support after install. |
| `dev` | `nuxt dev` | Start local SSR development. |
| `lint` | `eslint .` | Check source, tests, and configuration; no automatic mutation. |
| `typecheck` | `nuxt typecheck` | Check strict TypeScript and Vue templates. |
| `test` | `vitest run` | Execute real assertions; leave empty-suite failure enabled. |
| `test:watch` | `vitest` | Support later RED/GREEN development. |
| `build` | `nuxt build` | Produce `.output/` without contacting PocketBase. |
| `preview` | `nuxt preview` | Optional local production-output inspection. |

Do not add workspace configuration, a state manager, a UI kit, a grid library, a color-mode module, a generic repository abstraction, or the PocketBase SDK: Foundation's server-side configuration validation does not require it.

## 2. Theme and neutral shell

### Contract and data flow

`ThemeMode = 'dark' | 'light' | 'system'`. A small `useTheme` composable creates instance-local Vue `ref<ThemeMode>('dark')` state and calls Nuxt `useHead` with reactive `htmlAttrs: { 'data-theme': mode }`. Only the root shell owns this composable in Phase 0001. There is no module-level ref, cookie, localStorage, database preference, or request-shared singleton.

Flow: native selector -> typed theme ref -> Nuxt head attribute -> shared CSS variables -> shell/control colors. Bind the select using Vue's typed options/model; do not bypass typing with unchecked DOM casts.

- SSR emits `data-theme="dark"`; the CSS base palette is also dark. A fresh request/reload is dark even when the OS prefers light.
- `[data-theme="light"]` selects light variables and `color-scheme: light`.
- `[data-theme="dark"]` selects dark variables and `color-scheme: dark`.
- `[data-theme="system"]` uses the dark variables by default, overridden inside `@media (prefers-color-scheme: light)` for light variables and color scheme. CSS responds to subsequent OS changes immediately; no matchMedia listener, hydration-time detection, or event cleanup is required.
- The selected value remains `system` when the OS changes; CSS resolves appearance independently of Vue state. Lack of media-query support keeps the documented dark baseline.
- Reload intentionally discards the demonstration selection. Persisted product appearance is outside this phase.

CSS owns reusable tokens for background, surface, primary/muted text, border, focus/accent, semantic success/warning/error, font family, spacing, and restrained corner radius. Expose color/font tokens through Tailwind 4 `@theme inline` mappings to CSS custom properties. Use system monospace fonts, not downloaded assets. Choose dark and light values independently and verify contrast rather than merely inverting colors.

### UI contract

`app/app.vue` contains one main landmark, a normal-sized heading such as “Application foundation”, concise non-product placeholder text, and a labelled native appearance select with Dark/Light/System options. No dashboard tabs, account links, widgets, fake data, Settings surface, or PocketBase status widget.

Use flat backgrounds, thin borders, no shadow/gradient, wrapping content, visible outline focus, and a minimum 44 CSS-pixel control height. Keep body text readable (approximately 16px baseline) at tablet widths and 200% zoom. Native option selection and focus outlines provide cues beyond color. Use no animation or transition; reduced-motion users therefore receive no nonessential motion. Fluid layout must work at narrow widths without defining product device-layout breakpoints.

## 3. PocketBase and runtime configuration

### Endpoint-only boundary

Select a server-side endpoint configuration and validation boundary, not a preconstructed SDK client or a future data-access strategy. `server/utils/pocketbase.ts` exports a small pure validator and configuration accessor:

- `parsePocketBaseEndpoint(value: unknown): string` returns a normalized absolute base URL or throws a sanitized configuration error.
- `getPocketBaseConfig(config: { pocketbaseUrl: unknown }): Readonly<{ endpoint: string }>` delegates to that validator and exposes only the endpoint to future server-side data-access code.

Accept absolute HTTP/HTTPS URLs with a hostname, optional port and path prefix. Reject absent/blank/non-string values, relative URLs, malformed URLs, other protocols, userinfo credentials, query strings, and fragments. Normalize trailing separators consistently while preserving a reverse-proxy path prefix. Never interpolate the supplied raw value into errors or logs; errors identify `NUXT_POCKETBASE_URL` and the expected format only. HTTP is allowed for local development; later deployment security decisions remain deferred.

`server/plugins/pocketbase-config.ts` obtains private `useRuntimeConfig()` when Nitro starts and invokes the accessor once for validation. A missing or malformed endpoint prevents serving the application with a clear sanitized configuration failure. Do not evaluate environment values at Nuxt configuration import time or require a live service during build. Verify that the chosen Nitro version exhibits these startup semantics in both dev and production output.

No network request occurs in this boundary. A syntactically valid but unreachable endpoint does not prevent the neutral shell from rendering. Phase 0002 must decide SDK use and lifetime, authentication/session handling, and whether ordinary user-data access runs through the client, the server, or a bounded combination. The Foundation validation boundary is reusable configuration input, not a mandate that all PocketBase access is server-side. If browser PocketBase access is later selected, explicitly classify any required public endpoint then; do not expose it preemptively. Secret-requiring operations remain server-side.

### Configuration classification

| Value | Nuxt key | Exposure | Example |
|---|---|---|---|
| `NUXT_POCKETBASE_URL` | `runtimeConfig.pocketbaseUrl`, default empty string | Private server runtime configuration for Phase 0001; URL itself is not a secret, but this phase does not expose it publicly | `http://127.0.0.1:8090` |

Declare no app-specific public runtime values and no unused secret placeholders. `.env.example` contains the single safe local endpoint and a short comment describing the private Phase 0001 runtime classification. Local `.env` is ignored; never import dotenv or read `process.env` inside components. Nuxt's development tooling loads local `.env`; direct production Node startup requires the variable supplied by the process environment. The empty runtime default is intentional: missing configuration must not silently select localhost.

No credentials, auth store, SDK singleton, superuser bootstrap, health API route, user CRUD, schema, or provider integration is created by this Foundation plan. These scope constraints are governed by the OpenSpec artifacts and are not absence-only test targets. Native PocketBase internal initialization when running the binary is not an application schema migration and remains untracked runtime data.

## 4. Local PocketBase and future migrations

Document an independently installed official PocketBase binary on PATH, outside the repository. During apply, select and record an exact tested PocketBase release plus official OS/architecture download and checksum-verification instructions. Do not commit the executable, introduce Docker/service orchestration, or install credentials to prove connectivity.

Run from the repository root:

```sh
pocketbase --version
pocketbase serve --http=127.0.0.1:8090 --dir=./pb_data --migrationsDir=./pb_migrations
curl --fail --silent --show-error http://127.0.0.1:8090/api/health
```

Verify these flags against the chosen binary. A health GET requires no product records or privileged credentials. Document expected HTTP success and distinguish connection refusal/timeout from malformed app configuration; no need to consume or trust provider JSON in app code. If the binary creates empty migration directories, do not commit meaningless placeholders.

Record the migration decision in a new ADR, `docs/decisions/0008-pocketbase-migrations.md`, linked from the decision index and local guide:

- Future approved collection/rule changes use native version-controlled JavaScript migrations under root `pb_migrations/`, in PocketBase's generated timestamp order.
- Create a migration with the pinned binary's `pocketbase migrate create <name> --dir=./pb_data --migrationsDir=./pb_migrations`; inspect generated changes and implement/review forward and reverse behavior for the future feature.
- Apply pending migrations explicitly using `pocketbase migrate up --dir=./pb_data --migrationsDir=./pb_migrations` against the intended local database before serving. Explain that the pinned server's normal startup also applies pending migrations if supported; verify/document exact behavior so startup is not mistaken for read-only validation.
- Future migration acceptance requires a disposable-database test, owner-rule tests when applicable, and a documented backup/recovery plan. Never casually run migration rollback against valued data; destructive reversals require their own approved procedure.
- Commit migration source, not `pb_data/`, database files, uploaded content, credentials, binaries, or runtime-generated administrative setup output. No migration or collection is justified by Phase 0001.

This establishes a local versioning strategy, not a production deployment/backup system.

## 5. Planned file changes

| Path | Responsibility |
|---|---|
| `package.json`, `pnpm-lock.yaml`, `.node-version` | Pinned executable baseline and scripts. |
| `nuxt.config.ts`, `tsconfig.json` | Tailwind/ESLint integration, CSS entry, strict generated project references, private runtime key. |
| `eslint.config.mjs`, `vitest.config.ts` | Minimal real lint/test configuration. |
| `app/app.vue` | Neutral shell and accessible appearance demonstration. |
| `app/composables/useTheme.ts` | Typed transient mode and reactive head attribute. |
| `app/assets/css/main.css` | Tailwind import, palettes, theme selectors/media query, shared visual tokens. |
| `server/utils/pocketbase.ts` | Pure endpoint validation and typed private configuration boundary. |
| `server/plugins/pocketbase-config.ts` | Runtime startup validation without network access. |
| `tests/pocketbase-config.test.ts` | Positive, negative, normalization, and redaction cases. |
| `tests/theme.nuxt.test.ts` | Real composable/head/selector behavior and dark reset. |
| `.env.example`, `.gitignore` | Safe local example; retain current exclusions and add only actual generated outputs if necessary. |
| `docs/development/local-setup.md`, `README.md` | Authoritative local guide and short linked quick start; preserve product context. |
| `docs/architecture/configuration.md`, `docs/architecture/repository-shape.md` | Accepted endpoint classification and implemented minimal shape after verification. |
| `docs/decisions/0008-pocketbase-migrations.md`, `docs/decisions/README.md` | Durable migration ADR and index. |
| `openspec/config.yaml` | Verified runner/command/TDD capability only after successful checks. |
| `project/context.md`, `project/phase-map.md` | Verified progress and eventual archived phase state, never premature completion. |
| Active change tasks/verification artifacts | Work tracking, actual outputs, acceptance evidence, remaining blockers. |

Do not create empty `pages/`, `layouts/`, `components/`, `shared/`, `pb_hooks/`, widget directories, avatar assets, or `docs/specs/`. Extract a component only if implementation proves a genuine need.

## 6. Validation and evidence required during apply/verify

### Automated behavior

| Spec area | Required assertions/evidence |
|---|---|
| Accepted stack and workflow | Recorded package/runtime versions; frozen clean install; successful lint, strict typecheck, meaningful tests, production build. Verify app, server, tests, and Vue templates are covered by typecheck. |
| Endpoint handling | Accept local HTTP, HTTPS, port and path prefix; stable trailing-slash normalization; reject blank/missing/non-string, malformed/relative, forbidden protocol, credentials/query/fragment. Errors never contain submitted credential-like strings. |
| Server-side configuration validation | Accessor uses supplied runtime config; startup rejects invalid/missing config; validation performs no network I/O; errors do not disclose raw submitted values. |
| Theme behavior | Fresh mount dark; actual selector updates dark/light/system state and document head attribute; fresh mount resets dark; cleanup prevents leaked head state between tests. |
| No fake tests | Deliberately break an implemented theme selection case and an implemented endpoint validation case locally; show corresponding failures, restore, and rerun green. Never commit deliberate regressions. Do not add tests whose only purpose is proving future auth/dashboard/widget/provider features are absent. |

Use strict RED/GREEN for behavioral work once the runner works; capture the bootstrap limitation honestly. happy-dom cannot prove browser CSS media queries, accessibility, or real SSR hydration. Do not count a mocked media-query test as evidence of visual correctness.

### Reproducible command sequence

After applying code, use a clean checkout/worktree with no previous dependencies or `.nuxt` output. Worktrees needing CodeGraph belong under the user's home directory and need their own index. Provision documented Node/pnpm/PocketBase prerequisites, then:

```sh
node --version
pnpm --version
cp .env.example .env
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Start PocketBase in a separate terminal using the commands above when testing service availability. Nuxt itself must start without that service when its endpoint is valid. Inspect the URL printed by `pnpm dev` for a working shell.

Stop the dev process before testing default-port production startup:

```sh
NUXT_POCKETBASE_URL=http://127.0.0.1:8090 node .output/server/index.mjs
```

Verify the built server accepts runtime endpoint configuration rather than a baked-in build value. Separately start the built output with the variable absent and with a malformed dummy value: both must fail with sanitized guidance. Building and running unit tests must not need a reachable PocketBase instance.

Record command, working directory, tool versions, exit status, and relevant sanitized output in the later verification artifact. A passed `build` alone is not runtime evidence. Inspect tracked files with `git ls-files` and review public Nuxt payload/browser source for accidental credentials, unintended endpoint disclosure, local `.env`, database data, or binaries. Do not paste secret-bearing output into evidence.

### Manual browser matrix

Record browser/version, viewport, OS/emulated preference, result, and screenshots where useful:

1. Fresh load under both light and dark OS preferences: dark initial paint, dark selector, no hydration warnings.
2. Select light, then dark: HTML attribute, native control color scheme, text/background/border/focus contrast update. Reload returns dark without storage writes.
3. Select system under each OS preference; change the OS preference while selected and confirm appearance updates without reload. Explicit dark/light must ignore subsequent OS changes.
4. Keyboard Tab/arrow selection, visible non-color focus cues, accessible label, and touch targets; inspect desktop, tablet portrait/landscape, and narrow mobile widths plus 200% zoom. These are test viewports, not persisted layout breakpoints.
5. Reduced-motion enabled: no animation. Check text contrast at least 4.5:1 and meaningful control/focus contrast at least 3:1 in both palettes.
6. Valid endpoint with PocketBase stopped: shell still works; health command fails clearly. Start PocketBase: unauthenticated health succeeds without creating application records.
7. Browser network/storage inspection: the Foundation shell makes no network request as part of endpoint validation, does not persist the transient theme selection, and exposes no private runtime endpoint or secrets.

### Capability refresh

Only after meaningful `pnpm test` and `pnpm build` pass, refresh the existing OpenSpec capability configuration through the supported SDD initialization workflow or its documented equivalent. Record Vitest, `pnpm test`, and `pnpm build` in the existing capability structure; enable `strict_tdd` and apply TDD for verified unit/component coverage. Do not claim browser automation, database-rule testing, or coverage guarantees not implemented. Preserve all existing product context and rules.

## 7. Delivery, rollout, and rollback

Recommended task ordering: resolve/pin tooling and prove the runner; implement/test server-side endpoint configuration validation; implement/test theme and shell; document local runtime/migration strategy; perform clean-install, production-runtime, privacy, and browser verification; refresh truthful capabilities and tracking; verify and archive before Phase 0002.

The generated `pnpm-lock.yaml` is excluded from the 400-line manual review limit. The parent must measure and forecast the remaining changes by conceptual cohesion and risk during tasks, then pause under `ask-on-risk` before selecting delivery slices or accepting an exception. Do not split solely because of lockfile size. This design does not authorize chained PRs, a chain strategy, or `size:exception`. Logical work units are planning aids, not publishing consent.

There is no user-data rollout or migration. Revert foundation implementation work units to restore the documentation-only baseline, retaining OpenSpec history. Do not delete local `.env`, PocketBase data, or backups during rollback. Correct capability/project records if verified tooling is removed. Archive only after required automated/manual evidence passes with no unresolved critical verification blocker.

## Risks and open implementation checks

- Exact dependency and PocketBase releases still require resolution and recorded validation; no network/command verification was available during design.
- Nitro startup validation must be proven not to break the build and to reject missing deployment configuration at actual server startup.
- Nuxt's reactive head cleanup and happy-dom limitations require both component checks and real-browser hydration/theme evidence.
- Server-side endpoint configuration validation deliberately defers SDK ownership, authentication, and ordinary user-data access; Phase 0002 must not mistake it for a decision that all PocketBase access is server-side or for a finished CRUD boundary.
- The local guide must distinguish Nuxt `.env` loading, direct Node process environment, and PocketBase service availability.
- Review-budget delivery requires the parent's human-control gate; no product decision currently blocks task planning.
