# Phase 0002 — Authentication & Onboarding

Change name: `phase-0002-auth-onboarding`

Status: Planned

Depends on: Phase 0001

## Objective

Establish secure PocketBase user authentication, private ownership boundaries, and first-login onboarding.

## Must include

- PocketBase auth collection integration;
- login;
- logout;
- secure session/auth state strategy for Nuxt;
- per-user ownership conventions/access rules;
- profile baseline;
- bundled 8-bit avatar selection by stable key;
- timezone detection;
- geolocation permission request;
- manual location fallback/correction;
- onboarding completion state;
- idempotent creation of default Home + Search + Clock + Weather + Bookmarks records/config placeholders necessary for first use.

## Account model

Multiple accounts may exist, but they never share normal user data.

Public self-registration is not required for MVP. The design should choose the simplest account provisioning approach consistent with PocketBase administration and the product.

## Must not include

- team/workspace/role system;
- social login unless separately approved;
- password reset/email verification unless the phase spec intentionally adds them after owner approval;
- dashboard editing;
- real provider-backed weather behavior.

## Blocking decision to resolve

- exact PocketBase/Nuxt auth/session persistence strategy.

## Acceptance direction

- User A cannot read/write User B data through UI or direct normal PocketBase API use;
- refresh restores authenticated state safely according to chosen design;
- onboarding does not duplicate Home/default widget records on retry;
- denied geolocation does not block onboarding;
- arbitrary avatar uploads do not exist.
