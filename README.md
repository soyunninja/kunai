# Browser Startup Page — Product & SDD Repository Pack

> Working title. The final product name is intentionally undecided.

This repository is the specification and development handoff for a configurable browser startup page / personal command center.

The product is:

- personal per user, but supports multiple user accounts;
- dashboard-first;
- widget-driven;
- PocketBase-backed;
- operational, not merely informational;
- visually inspired by terminal/TUI interfaces;
- designed primarily for desktop and tablet, with mobile support;
- developed with Pi + gentle-ai using Spec-Driven Development (SDD) and OpenSpec file artifacts.

## Start here

Humans should read `START_HERE.md` first.

Pi automatically loads `AGENTS.md`. The agent must then read the project context and the active phase brief before starting work.

## Accepted stack

- Nuxt 4
- Vue 3
- TypeScript
- Tailwind CSS 4
- PocketBase
- pnpm

The stack is fixed unless the product owner explicitly approves a change and a superseding ADR is added.

## Default account experience

A user owns a private personal space. There are no shared dashboards, workspaces, organizations, or collaborative permissions in the MVP.

A new user starts with exactly one dashboard named `Home` containing:

1. Search
2. Local Clock
3. Local Weather
4. Bookmarks

The user may create additional dashboard tabs such as `Travel`, `Dev`, or anything else.

## SDD source of truth

Product intent and stable architectural constraints live under `docs/` and `project/`.

Actual SDD change artifacts are created by gentle-ai under `openspec/changes/` using the official flow:

`explore -> propose -> spec -> design -> tasks -> apply -> verify -> archive`

Do not create a second competing `docs/specs/` workflow.

## Repository map

```text
.
├── AGENTS.md
├── README.md
├── START_HERE.md
├── project/
│   ├── context.md
│   ├── rules.md
│   ├── product-decisions.md
│   ├── open-decisions.md
│   └── phase-map.md
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── ux/
│   ├── integrations/
│   ├── phases/
│   ├── workflow/
│   ├── decisions/
│   └── reference/
└── openspec/
    ├── config.yaml
    ├── specs/
    └── changes/
        └── archive/
```

## Explicit MVP non-goals

- no project/task/time-tracking system yet;
- no shared dashboards;
- no collaborative permissions;
- no email integration;
- no infrastructure uptime monitoring;
- no universal internal search;
- no large developer tool catalog;
- no general notes application;
- no Japan events/matsuri integration yet;
- no train planner;
- no PWA/offline requirement yet.
