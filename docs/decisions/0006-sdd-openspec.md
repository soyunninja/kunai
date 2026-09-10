# ADR 0006 — SDD with OpenSpec File Artifacts

Status: Accepted

Date: 2026-09-10

## Decision

Use gentle-ai Spec-Driven Development with `openspec` as the default artifact store for project changes.

## Context

The owner explicitly wants durable files so AI agents can understand product intent, phases, and implementation history without relying on one chat session.

## Consequences

- OpenSpec artifacts are committed/versioned;
- phase briefs live under `docs/phases/` as input, not as competing SDD artifacts;
- no custom `docs/specs/` lifecycle should be maintained;
- Engram may complement but does not replace the file source of truth.
