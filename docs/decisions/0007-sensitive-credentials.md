# ADR 0007 — Sensitive User Integration Credentials

Status: Accepted

Date: 2026-09-10

## Decision

User-owned sensitive integration credentials must remain server-side after storage.

If persisted in PocketBase, secret material is encrypted at the application layer using a server environment key and stored in collections unavailable to normal browser access.

## Consequences

- AI provider keys are never returned in full to browser JavaScript;
- OAuth tokens are handled by trusted server code;
- encryption keys are not stored in PocketBase;
- UI may show connection/configuration state but not recoverable plaintext secrets.
