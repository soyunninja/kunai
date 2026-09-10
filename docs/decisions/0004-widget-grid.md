# ADR 0004 — Widget Grid and Size Model

Status: Accepted

Date: 2026-09-10

## Decision

Use an 8-column logical grid for desktop/tablet landscape.

Dashboard height is unbounded.

Every widget type declares a finite legal size set.

Global widget height is capped at 3 rows.

Persist desktop, tablet, and mobile layouts independently.

## Consequences

- widgets need intentional size-aware variants;
- no arbitrary freeform dimensions;
- layout validation is centralized;
- vertical scrolling is expected;
- responsive changes must not mutate another saved device layout.
