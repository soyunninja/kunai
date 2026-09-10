# ADR 0005 — External Integration Boundary

Status: Accepted

Date: 2026-09-10

## Decision

External providers are accessed through explicit normalized app adapters/services.

Sensitive provider operations use trusted Nuxt server boundaries.

## Consequences

- widget components do not consume arbitrary raw provider payloads;
- secrets are not placed in client code;
- providers can be replaced with bounded impact;
- widget errors can be isolated.
