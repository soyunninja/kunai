# ADR 0002 — Personal Per-user Isolation

Status: Accepted

Date: 2026-09-10

## Decision

The product supports multiple authenticated users, but each user owns a private personal space.

There is no shared workspace or collaboration model in the MVP.

## Consequences

- user-owned records are scoped by owner;
- PocketBase access rules enforce isolation;
- no team roles are required;
- dashboards are not shareable;
- settings/integrations are user-specific.

## Guardrail

Do not introduce organization/workspace/team permission models without a new product decision.
