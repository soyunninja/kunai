# AGENTS.md

This file is the main project context entrypoint for Pi and other coding agents.

The project uses Pi + gentle-ai and Spec-Driven Development with OpenSpec file artifacts.

## Mandatory startup reading

Before changing implementation files, read:

1. `AGENTS.md`
2. `project/context.md`
3. `project/rules.md`
4. `project/product-decisions.md`
5. `project/open-decisions.md`
6. `docs/product/vision.md`
7. `docs/product/mvp.md`
8. `docs/architecture/overview.md`
9. the current phase brief from `docs/phases/`
10. relevant ADRs and integration/UX documents for that phase

Do not ask the owner to repeat information already documented here.

## SDD contract

For substantial work, use gentle-ai SDD.

This repository explicitly requires file-based SDD artifacts. Use `openspec` as the artifact store unless the owner explicitly changes that decision.

Official SDD artifacts belong under:

`openspec/changes/{change-name}/`

Do NOT create or revive a parallel `docs/specs/` process.

The intended phase flow is:

`explore -> propose -> spec -> design -> tasks -> apply -> verify -> archive`

A phase brief under `docs/phases/` is product input for SDD. It is not a substitute for the generated OpenSpec proposal/spec/design/tasks.

## Core product model

The application is a personal browser startup page / command center.

Multiple user accounts may exist, but each user's data is private and independent.

There is no shared workspace, dashboard sharing, organization model, team role model, or collaborative permission system in the MVP.

A user may own multiple dashboards. Dashboards are tabs, not hard-coded product sections.

Examples such as `Travel` and `Dev` are user-created dashboards assembled from reusable widgets.

## Default new-user state

A newly onboarded user gets exactly one dashboard:

`Home`

Home contains exactly these initial widget instances:

- Search
- Local Clock
- Local Weather
- Bookmarks

Do not create Travel or Dev automatically.

## Dashboard invariants

- Desktop/tablet landscape logical grid: 8 columns.
- Vertical dashboard length is unrestricted; scrolling is expected.
- Global widget height maximum: 3 rows.
- Each widget type declares its own legal sizes.
- A widget may be instantiated more than once.
- Each widget instance has its own configuration.
- Normal mode does not allow accidental move/resize.
- Edit mode enables add, move, resize, configure, duplicate, and remove.
- Dashboard tabs can be created, renamed, reordered, switched, and removed according to the current spec.
- Device layouts are persisted independently for desktop, tablet, and mobile.
- Changing viewport width must not silently rewrite another device layout.

## Search invariants

- Search is a dashboard widget.
- Google is the default search engine.
- Users may configure external search engines and short aliases.
- Search is not a universal internal search in the MVP.
- It does not search bookmarks, notes, dashboards, or PocketBase records.
- Do not introduce a command palette unless a future spec adds it.

## Widget/product invariants

- Standard Weather represents one configured location.
- Weather may show current conditions plus the next 2 days when its legal size has enough room.
- Multi-location weather is a separate Travel widget.
- Markets can show multiple user-selected symbols in one widget.
- Currency is interactive and supports direct amount conversion; EUR/JPY is a primary use case but the widget should be configurable.
- Google Calendar is read-only in the MVP and shows the next 3 days.
- The user selects which Google calendars are visible in Settings.
- Scratchpad autosaves. It is not a general notes product.
- Dev MVP contains only Color Converter and Password Generator.
- Color Converter supports HEX, RGB, HSL, and OKLCH.
- Password generation happens locally with a cryptographically secure browser API and passwords are never persisted.
- Travel MVP excludes train routing, time conversion, phrase lists, and event/matsuri feeds.

## Settings invariants

Settings include the product areas currently specified:

- profile;
- avatar selection;
- location/timezone;
- appearance;
- dashboards;
- search engines;
- weather default/location settings;
- markets/watchlist;
- Google Calendar connection/selection;
- AI provider/model/credentials.

Appearance defaults to `dark`, with `light` and `system` available.

Avatars are selected from a bundled owner-provided set of 8-bit assets. Do not implement arbitrary user photo upload in the MVP.

## Accepted engineering stack

- Nuxt 4
- Vue 3
- TypeScript
- Tailwind CSS 4
- PocketBase
- pnpm

Do not replace any of these without explicit owner approval and a superseding ADR.

## Architecture boundaries

- PocketBase is the persistent database/auth backend.
- Do not create PocketBase clients ad hoc inside arbitrary components.
- User-owned CRUD must pass through a consistent app data-access boundary.
- PocketBase access rules must enforce owner isolation.
- External integrations should use explicit adapters/boundaries.
- Secrets and provider credentials must never be returned to browser JavaScript after storage.
- Sensitive integrations belong behind Nuxt server routes/services.
- Do not expose PocketBase superuser credentials to the client.
- Do not put secrets in source control.

## TypeScript and code quality

Internal identifiers use English.

Use strict TypeScript.

Avoid:

- `any`;
- `@ts-ignore`;
- unsafe casts to bypass contracts;
- undocumented global state;
- provider payload assumptions without validation;
- hidden fallback behavior;
- broad abstractions created for hypothetical future features.

Prefer:

- small explicit modules;
- typed DTOs/provider results;
- pure transformations where practical;
- deterministic layout validation;
- resilient widget-level loading/error states;
- accessibility and keyboard support without sacrificing tablet touch use.

## Scope discipline

Do not implement deferred features simply because they seem natural.

Explicitly deferred:

- project/client/task/time management;
- collaboration;
- email;
- uptime/service monitoring;
- full notes app;
- internal universal search;
- broad developer tools catalog;
- Japan events/matsuri feed;
- train planner;
- PWA/offline support.

## Documentation maintenance

After verified meaningful progress:

- update `project/context.md`;
- update `project/phase-map.md` when phase status changes;
- update docs when an accepted contract changes;
- add/supersede an ADR for architecture decisions;
- never rewrite archived OpenSpec changes to hide history.

## Completion gate

A phase is complete only after:

- OpenSpec requirements are implemented;
- relevant tests/checks pass;
- manual UX checks pass where required;
- `/sdd-verify` has no unresolved critical blocker;
- the change is archived;
- project context/phase map reflect the verified state.
