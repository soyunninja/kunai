# Phase 0010 — Hardening & Release Readiness

Change name: `phase-0010-hardening`

Status: Planned

Depends on: all intended MVP feature phases

## Objective

Make the current MVP reliable enough for daily browser-startup use without expanding product scope.

## Must include

- full owner-isolation audit;
- secret exposure audit;
- error-boundary/widget failure audit;
- responsive validation: desktop/tablet/mobile;
- tablet touch edit-mode validation;
- keyboard/focus accessibility baseline;
- reduced-motion check;
- theme validation: dark/light/system;
- startup/render performance review;
- external provider timeout/retry/rate-limit behavior review;
- empty/loading/error states;
- corrupted layout/config recovery tests;
- production environment/deployment documentation;
- backup/restore guidance for PocketBase data as appropriate;
- final README runbook.

## Must not include

- new product feature categories;
- PWA/offline mode unless separately approved;
- redesign for redesign's sake.

## Release gate

- no known cross-user data leak;
- no provider secret exposed to client;
- automated checks pass;
- SDD verification passes;
- primary desktop/tablet usage is manually validated;
- mobile remains functional;
- deployment steps are reproducible.
