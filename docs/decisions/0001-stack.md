# ADR 0001 — Application Stack

Status: Accepted

Date: 2026-09-10

## Decision

Use:

- Nuxt 4
- Vue 3
- TypeScript
- Tailwind CSS 4
- PocketBase
- pnpm

## Context

The product is a browser-first personal dashboard with dynamic widgets, settings, authentication, server-side integration boundaries, and a small self-hostable backend.

## Consequences

- Nuxt owns the web/client/server application surface.
- PocketBase owns authentication and persistent application records.
- TypeScript contracts should be used around PocketBase/provider data.
- Tailwind supports the compact custom visual system.
- A monorepo is not required by default.

## Guardrail

Changing the frontend framework, backend/database, language, or styling foundation requires explicit owner approval and a superseding ADR.
