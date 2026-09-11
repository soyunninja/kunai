# Tasks — Phase 0001 Foundation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated manually reviewed lines | To be reassessed during apply; exclude generated `pnpm-lock.yaml` |
| Generated lockfile treatment | `pnpm-lock.yaml` is excluded from the 400-line manual review limit |
| 400-line budget risk | Medium; depends on conceptual code/docs, not generated lockfile size because tooling, server-side configuration validation, visual behavior, and operational documentation are distinct risk areas |
| Delivery strategy | ask-on-risk |
| Chain strategy | not selected; choose only if conceptual cohesion or risk warrants it |

Decision needed before apply: No current blocker; reassess at apply time using conceptual/manual-review changes only.
Chained PRs recommended: Not currently required solely by size; choose only for conceptual or risk boundaries.
Chain strategy: not selected.
400-line budget risk: Medium.

Before apply, assess delivery under `ask-on-risk` using conceptual cohesion and risk. Do not split changes or accept a size exception solely because of generated lockfile size. If slicing is needed, use independent tooling, configuration-validation, and visual/documentation work units; do not infer a chain strategy.

## Proposed autonomous work units

1. **Tooling baseline:** executable Nuxt/Tailwind/lint/typecheck/test configuration and its generated lockfile; rollback removes the root application baseline as one unit.
2. **Server-side configuration validation:** endpoint parser and startup validation with its behavior tests; rollback removes the boundary without affecting the tooling baseline.
3. **Theme shell and documentation:** accessible transient theme UI, local-operation/migration guidance, and final evidence; rollback removes neutral UI and documentation without introducing product data.

## 1. Tooling baseline

- [x] Resolve compatible, exact Nuxt 4/Vue 3/Tailwind 4/TypeScript/ESLint/Vitest package versions and implement the conventional root baseline in `package.json`, `pnpm-lock.yaml`, `.node-version`, `nuxt.config.ts`, `tsconfig.json`, `eslint.config.mjs`, and `vitest.config.ts`; configure SSR, Tailwind’s Vite plugin, Nuxt ESLint, strict generated type references, Nuxt/happy-dom tests, and the documented `postinstall`, `dev`, `lint`, `typecheck`, `test`, `test:watch`, `build`, and `preview` scripts without adding a UI kit, state manager, grid library, PocketBase SDK, or monorepo. Verify the resolved version table and a frozen install, then retain this work as a rollbackable tooling-only unit. <!-- sdd-owner: implementation -->
- [x] Add the initial meaningful Vitest test harness under `tests/` and prove it can fail by introducing then reverting a deliberate local assertion failure; run `pnpm test`, `pnpm lint`, and `pnpm typecheck` after restoration so later behavioral tasks can use strict RED → GREEN → TRIANGULATE → REFACTOR cycles. Rollback removes only the test baseline and its related configuration. <!-- sdd-owner: implementation -->

## 2. Server-side PocketBase configuration validation boundary

- [x] **RED:** Create failing node-environment cases in `tests/pocketbase-config.test.ts` for `server/utils/pocketbase.ts`, covering valid HTTP/HTTPS endpoints with ports/path prefixes, trailing-slash normalization, and rejection of missing, blank, non-string, malformed, relative, credential-bearing, query-bearing, fragment-bearing, and unsupported-protocol input; assert sanitized failures never echo supplied credential-like values. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Implement `parsePocketBaseEndpoint` and `getPocketBaseConfig` in `server/utils/pocketbase.ts`, and configure the non-public `runtimeConfig.pocketbaseUrl` default in `nuxt.config.ts`, satisfying the endpoint cases without network I/O, SDK creation, public runtime keys, or logging of raw input. Keep this as server-side configuration validation only: Phase 0002 decides authentication and ordinary user-data client/server access, while secret-requiring operations remain server-side. Run the targeted test file and preserve this boundary as an independently reversible work unit. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Add failing-then-passing startup cases for `server/plugins/pocketbase-config.ts` that demonstrate valid configuration permits dev/production server startup while absent or malformed configuration fails at server startup, not build time; verify a syntactically valid but unreachable endpoint does not block shell rendering and no request is made to it. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Review `server/utils/pocketbase.ts`, `server/plugins/pocketbase-config.ts`, and `tests/pocketbase-config.test.ts` for a small typed API, duplicate normalization logic, strict-TypeScript compliance, and sanitized errors; rerun the targeted suite, `pnpm lint`, and `pnpm typecheck` without changing deferred SDK/session decisions. <!-- sdd-owner: implementation -->
- [x] Add `.env.example` with only the documented safe `NUXT_POCKETBASE_URL` example and update `.gitignore` only for actual generated/local outputs; verify tracked files and Nuxt public runtime/payload configuration contain neither `.env`, `pb_data/`, credentials, provider placeholders, nor unintended endpoint exposure. Rollback removes the example/config exposure changes only. <!-- sdd-owner: implementation -->

## 3. Theme shell and visual baseline

- [x] **RED:** Add failing Nuxt/happy-dom tests in `tests/theme.nuxt.test.ts` for `app/composables/useTheme.ts` and `app/app.vue`: fresh state is dark, selector changes update the typed `data-theme` head attribute for dark/light/system, a fresh mount resets to dark, and test cleanup prevents head-state leakage. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Implement the instance-local `ThemeMode` composable in `app/composables/useTheme.ts`, the neutral one-main-landmark shell and labelled native appearance selector in `app/app.vue`, and dark/light/system CSS token resolution in `app/assets/css/main.css`; set dark SSR/base rendering, resolve system mode through CSS media queries, and avoid storage, cookies, account preferences, dashboard/navigation/widget semantics, animation, or component extraction. Run the theme suite and retain this UI as a separately reversible work unit. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Extend `tests/theme.nuxt.test.ts` with explicit light-versus-system behavior and selector keyboard-operability assertions, then implement only the missing behavior needed for those cases; rerun the theme suite and confirm test failures can be induced locally and restored before commit. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Refine `app/assets/css/main.css`, `app/app.vue`, and `app/composables/useTheme.ts` for shared Tailwind-mapped CSS tokens, system monospace typography, flat surfaces, thin borders, semantic colors, visible non-color focus treatment, 44px minimum control height, readable wrapping/zoom behavior, and no nonessential motion; rerun theme tests, lint, and typecheck. <!-- sdd-owner: implementation -->

## 4. Local operations and migration strategy

- [x] Document reproducible setup, pinned Node/pnpm/PocketBase versions, frozen installation, `.env` setup, Nuxt commands, independent PocketBase `serve`/health commands, missing-invalid-unreachable endpoint troubleshooting, and runtime-production configuration in `docs/development/local-setup.md`; link the concise path from `README.md` without implying PocketBase is contacted by builds/tests or directing maintainers to create product data. <!-- sdd-owner: implementation -->
- [x] Create `docs/decisions/0008-pocketbase-migrations.md` and link it from `docs/decisions/README.md`; specify root `pb_migrations/`, pinned-binary create/apply workflow, forward/reverse review, disposable-database and owner-rule testing for later changes, backup/recovery expectations, and the prohibition on committing `pb_data/`, binaries, credentials, generated admin output, placeholder migrations, initial schemas, collections, or owner rules. Update `docs/architecture/configuration.md` and `docs/architecture/repository-shape.md` to record only the implemented server-side endpoint configuration validation boundary and minimal repository shape. <!-- sdd-owner: implementation -->

## 5. Integrated validation and truthful capability update

- [x] From a clean checkout/worktree, record sanitized evidence for exact tool versions, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; then run built output with a valid endpoint and separately with missing/malformed endpoint values to verify runtime—not build-time—validation. Confirm neither tests nor builds need a reachable PocketBase service and rollback only changes found to invalidate these checks. <!-- sdd-owner: implementation -->
- [x] Perform and record the design’s manual browser matrix for initial dark paint under both OS preferences, explicit dark/light/system behavior, system preference changes, no hydration warnings, keyboard/touch focus cues, tablet/narrow/200%-zoom readability, reduced motion, contrast, no persistence, valid-but-stopped PocketBase behavior, health behavior, and browser network/storage privacy. <!-- sdd-owner: implementation -->
- [x] Only after the meaningful test and build evidence passes, update `openspec/config.yaml` with the verified Vitest command/build command and `strict_tdd: true`; do not claim browser automation, coverage, database-rule testing, or any capability that was not demonstrated, and leave phase completion/archive tracking for the later verify/archive phases. <!-- sdd-owner: implementation -->
