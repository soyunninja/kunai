# Phase 0004 — Widget Grid Engine

Change name: `phase-0004-widget-grid-engine`

Status: Planned

Depends on: Phase 0003

## Objective

Build the reusable widget registry, persisted device layouts, and edit-mode grid interactions.

## Must include

- authoritative widget registry contract;
- stable widget type identifiers;
- legal-size declarations;
- default size per type;
- global max height 3;
- 8-column desktop/tablet landscape grid;
- unbounded vertical rows/scroll;
- desktop/tablet/mobile persisted layout fields;
- add widget catalog framework;
- drag/move in edit mode;
- resize only through legal sizes;
- configure entry point;
- duplicate;
- remove;
- normal mode with no accidental move/resize;
- invalid/corrupt layout validation and deterministic fallback;
- touch-safe tablet editing.

## Product behavior

The same widget type may be instantiated multiple times with independent config.

Any widget may appear on any dashboard regardless of catalog category.

## Must not include

- implementation of provider-backed final widgets beyond minimal fixtures/demo widget(s) needed to validate the engine;
- speculative widget features.

## Blocking decisions to resolve

- exact responsive breakpoint values;
- mobile column model;
- grid compaction/collision behavior;
- library choice (if any) for drag/resize versus a smaller custom/native implementation.

## Acceptance direction

- legal sizes are enforced centrally;
- invalid stored size cannot crash dashboard;
- editing one device layout does not mutate another;
- tablet touch interaction is usable;
- normal mode remains stable.
