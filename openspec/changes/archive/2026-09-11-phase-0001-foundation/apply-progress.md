# Apply Progress — Phase 0001 Foundation

## Status consumed

- Change: `phase-0001-foundation`
- Native apply state: `ready`
- Action context: `repo-local`
- Allowed edit root: `/home/baldboy/desarrollo/soyunninja/kunai.pro`
- Action-context warnings: none
- Skill resolution: `paths-injected` (`gentle-ai`, `gentle-ai-work-unit-commits`)

## Completed implementation tasks

All sixteen implementation-owned task rows are visibly checked in `tasks.md`:

1. Tooling baseline and frozen lockfile.
2. Meaningful Vitest harness provided by the endpoint and theme behavior suites, including deliberate failing cases restored to green.
3. PocketBase endpoint validation RED and GREEN work.
4. PocketBase startup-validation TRIANGULATE and REFACTOR work.
5. Safe private endpoint example and generated-output ignores.
6. Theme RED, GREEN, TRIANGULATE, and REFACTOR work.
7. Local setup, migration ADR, and architecture documentation.
8. Verified OpenSpec test/build capability and strict TDD setting.

## Files changed

- Tooling: `package.json`, `pnpm-lock.yaml`, `.node-version`, `nuxt.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`.
- Application: `app/app.vue`, `app/composables/useTheme.ts`, `app/assets/css/main.css`.
- Server: `server/utils/pocketbase.ts`, `server/plugins/pocketbase-config.ts`.
- Tests: `tests/setup.ts`, `tests/pocketbase-config.test.ts`, `tests/theme.nuxt.test.ts`.
- Documentation: `README.md`, `docs/development/local-setup.md`, `docs/decisions/0008-pocketbase-migrations.md`, `docs/decisions/README.md`, `docs/architecture/configuration.md`, `docs/architecture/repository-shape.md`, `project/context.md`, `project/phase-map.md`.
- SDD: `openspec/config.yaml`, `openspec/changes/phase-0001-foundation/tasks.md`, this artifact.

## Resolved versions

| Tool or direct package | Version |
| --- | --- |
| Node.js | `24.18.0` |
| pnpm | `10.34.5` |
| Nuxt | `4.4.8` |
| Vue | `3.5.40` |
| Tailwind CSS / Vite plugin | `4.1.17` |
| TypeScript | `5.9.3` |
| ESLint | `9.39.4` |
| Vite | `7.3.6` |
| Vitest | `4.0.15` |
| Nuxt test utilities | `4.3.2` |
| PocketBase documentation target | `0.40.3` |

Vite is pinned directly to keep the Tailwind Vite plugin on Nuxt's Vite 7 type surface rather than resolving a conflicting Vite 8 peer instance.

## TDD cycle evidence

| Work unit | RED | GREEN | TRIANGULATE | SAFETY NET |
| --- | --- | --- | --- | --- |
| Endpoint parser | ✅ Written — missing `server/utils/pocketbase.ts` caused `tests/pocketbase-config.test.ts` import failure. | ✅ Passed — parser/configuration accessor passes 19 endpoint/startup tests with sanitized errors. | Deliberate HTTP-rejection regression later failed 3 endpoint/startup cases and was restored to 19/19 passing. | New behavior had no prior production baseline; `tests/pocketbase-config.test.ts` is now the safety net. |
| Startup plugin | ✅ Written — missing `server/plugins/pocketbase-config.ts` caused an import failure. | ✅ Passed — valid unreachable configuration passes without a `fetch` call; invalid values throw sanitized configuration errors. Built-output runtime evidence is recorded below. | Endpoint parser regression also failed valid-unreachable startup behavior and was restored. | New behavior had no prior production baseline; endpoint startup tests and built-output runtime checks are now the safety net. |
| Theme shell | ✅ Written — missing composable caused `tests/theme.nuxt.test.ts` import failure. | ✅ Passed — Nuxt/happy-dom suite passes dark reset, selector, light/system distinction, label/native-control semantics, and head cleanup tests. | A temporary wrong expectation for system mode failed and was restored. | New behavior had no prior production baseline; theme suite and manual matrix are now the safety net. |

`strict_tdd` was enabled only after the verified meaningful test/build baseline passed. No browser automation, coverage, or database-rule testing capability is claimed. The initial tautological harness-only test was removed during verification correction; the remaining suites exercise implemented endpoint and theme behavior only.

Verification correction evidence: temporarily rejecting local HTTP endpoints in `server/utils/pocketbase.ts` made `tests/pocketbase-config.test.ts` fail with 3 failures, then restoring the implementation returned the focused suite to 19/19 passing. The red log was `/tmp/kunai-endpoint-deliberate-red.log`; the restored green log was `/tmp/kunai-endpoint-restored-green.log`.

## Automated validation evidence

Final command sequence from the repository working tree:

```text
pnpm install --frozen-lockfile  -> exit 0
pnpm lint                       -> exit 0
pnpm typecheck                  -> exit 0
pnpm test                       -> exit 0 (2 files, 22 tests)
pnpm build                      -> exit 0 (Nuxt 4.4.8, Nitro 2.13.4, Vite 7.3.6, Vue 3.5.40)
```

The frozen install used pnpm `10.34.5`. It printed pnpm's informational ignored-build-script notice for transitive `esbuild` and `unrs-resolver`; all required commands succeeded. The build printed known upstream sourcemap warnings from Nuxt/Tailwind plugins but completed successfully.

Built-output checks after the final build:

- `NUXT_POCKETBASE_URL=http://127.0.0.1:8090/unreachable node .output/server/index.mjs` served the shell at `/`; the response contained `Application foundation` and no endpoint value.
- Missing endpoint startup exited `1` with the sanitized `NUXT_POCKETBASE_URL` message.
- Malformed endpoint startup exited `1`; the raw malformed value was absent from its output.
- A stopped local health endpoint returned curl exit `7`, while the valid-but-unreachable Nuxt configuration still served the shell.
- `.output/public` contained no private endpoint variable or configured endpoint string.
- `git diff --check` passed.

## Headless browser checks

Google Chrome was available at `/usr/bin/google-chrome`. Headless rendering verified SSR `data-theme="dark"`, the labelled native appearance selector, and the neutral shell. Reviewed screenshots at 768px tablet width and 320px narrow width showed readable wrapping, flat surfaces, thin borders, and an unclipped 44px selector.

Human manual browser validation completed over the Tailscale-accessible dev server after rebinding Nuxt dev to `0.0.0.0:3000`. The user confirmed:

- normal local startup rendered the Foundation shell;
- initial appearance was dark;
- manual light mode worked;
- manual system mode worked;
- system mode followed real operating-system preference changes without reload;
- the appearance selector was keyboard-operable with visible focus;
- basic touch/responsive behavior was usable;
- 200% browser zoom remained readable and usable;
- dark/light/system contrast and legibility were visually acceptable;
- selecting light/system did not persist after reload;
- localStorage, sessionStorage, and cookies contained no theme/user preference state;
- Network inspection exposed no private PocketBase configuration and made no browser PocketBase request;
- the shell worked while PocketBase was stopped.

PocketBase `0.40.3` was downloaded to `/tmp/kunai-pocketbase/` outside the repository and started with `--http=127.0.0.1:8090 --dir=./pb_data --migrationsDir=./pb_migrations`. `curl --fail --silent --show-error http://127.0.0.1:8090/api/health` returned `{"message":"API is healthy.","code":200,"data":{}}`. The user then confirmed the app continued to render unchanged with PocketBase available, with no browser requests to `:8090` and no product UI/data. `pb_data/` is ignored runtime data; no product schema, collections, migrations, auth, dashboard, widget, or provider behavior was created.

## Deviations from design

- `srcDir: 'app/'` is explicit in `nuxt.config.ts` so Nuxt resolves the planned `app/assets/css/main.css` through the conventional `~/assets` entry.
- A direct Vite pin is necessary to prevent Tailwind's Vite peer from selecting a conflicting Vite 8 type instance. This is tooling compatibility only, not a new framework or architectural layer.

## Additional validation after apply agent

A clean copied working directory at `/tmp/kunai-phase-0001-clean` was created without `.git`, `node_modules`, `.nuxt`, `.output`, `.cache`, or `pb_data`. It reproduced:

```text
node --version                  -> v24.18.0
pnpm --version                  -> 10.34.5
pnpm install --frozen-lockfile  -> exit 0
pnpm lint                       -> exit 0
pnpm typecheck                  -> exit 0
pnpm test                       -> exit 0 (2 files, 22 tests)
pnpm build                      -> exit 0
```

The clean directory built-output checks also passed: a valid unreachable endpoint served the shell, missing and malformed endpoint values exited nonzero with sanitized `NUXT_POCKETBASE_URL` guidance, and the configured endpoint string was absent from `.output/public`.

The repository working tree was also revalidated with the same minimum command sequence and built-output checks.

## Remaining tasks

None for apply. Phase 0001 is ready for SDD verification; it is not archived yet.

## Final post-matrix validation

After recording the human manual matrix, the repository working tree was validated again:

```text
pnpm lint       -> exit 0
pnpm typecheck  -> exit 0
pnpm test       -> exit 0 (2 files, 22 tests)
pnpm build      -> exit 0
git diff --check -> exit 0
```

The build retained the known upstream sourcemap warnings from Nuxt/Tailwind plugins and completed successfully.

## Workload and delivery boundary

The task forecast was Medium risk under `ask-on-risk`, with no delivery decision required before apply. Work remains organized as three independently reversible units: tooling baseline, server-side configuration validation, and theme/documentation. No commit, branch, PR, chain, or size exception was created.
