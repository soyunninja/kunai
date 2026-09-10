# ADR 0003 — Generic Dashboard Tabs

Status: Accepted

Date: 2026-09-10

## Decision

Dashboards are user-owned data records rendered by one common dashboard engine.

`Home`, `Travel`, and `Dev` are not separate hard-coded application modules.

## Consequences

- users can create arbitrary dashboard tabs;
- widget catalog category does not restrict placement;
- Travel and Dev emerge from widget composition;
- new themed dashboards require no new page architecture.
