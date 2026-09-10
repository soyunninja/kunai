# Phase 0005 — Home/Core Widgets

Change name: `phase-0005-home-widgets`

Status: Planned

Depends on: Phase 0004

## Objective

Deliver the first genuinely useful startup-page experience.

## Widgets

### Search

- Google default;
- configurable external engines/aliases;
- safe URL/query construction;
- no internal search.

### Clock

- local timezone default;
- size-aware compact display;
- design may support additional configured zones in an instance, with Tokyo as an important use case, without changing the default onboarding instance.

### Weather

- one location;
- current conditions;
- next 2 days when legal size permits;
- manual location config;
- chosen weather provider behind normalized adapter.

### Bookmarks

- name + URL;
- optional category;
- uncategorized links;
- favicon derived automatically;
- text fallback;
- simple add/edit/order UX.

### Scratchpad

- optional addable widget;
- autosave;
- lightweight Markdown content;
- no Save button;
- `Cmd+Enter` archives current entry and creates an empty active entry;
- limited history only as needed to make archive meaningful.

## Required design work

Define and owner-review the legal size matrix and content variants for every widget before implementation.

## Blocking decision

- weather provider.

## Must not include

- universal internal search;
- multiple locations in standard Weather;
- full notes app;
- seeded default bookmarks required for every user.

## Acceptance direction

A newly onboarded Home can render and operate its four default widgets, and the user can add Scratchpad if desired.
