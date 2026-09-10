# Phase 0001 — Foundation

Change name: `phase-0001-foundation`

Status: Ready

## Objective

Create the smallest maintainable project foundation for the accepted Nuxt/PocketBase stack without implementing real product features early.

## Must include

- Nuxt 4 + Vue 3 + TypeScript project foundation;
- Tailwind CSS 4 baseline;
- pnpm scripts/workflow;
- PocketBase local connection/config boundary;
- environment variable strategy and `.env.example` once code exists;
- dark/light/system theme foundation, dark default;
- terminal-inspired base visual tokens;
- minimal application shell placeholders;
- lint/typecheck/test/build commands appropriate to the stack;
- local development documentation;
- versioned PocketBase migration strategy decision if schema migrations are introduced later.

## Must not include

- login/onboarding UX;
- real dashboard records;
- grid engine;
- widget registry beyond a minimal placeholder only if structurally necessary;
- external provider integrations;
- real widgets.

## Architecture constraints

- keep a conventional single Nuxt app unless a real requirement forces otherwise;
- centralize PocketBase client/data access setup;
- do not leak secrets into public runtime config;
- avoid major UI frameworks unless explicitly approved.

## Acceptance direction

- clean checkout can install with pnpm;
- app starts locally;
- build/typecheck/lint/test baseline passes;
- theme can represent dark/light/system with dark default;
- PocketBase endpoint configuration is documented;
- no product scope from later phases is implemented accidentally.

## SDD notes

Strict TDD may initially be unavailable until testing tooling exists. After this phase, refresh SDD testing capabilities so future phases can use the detected runner.
