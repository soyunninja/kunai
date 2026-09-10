# Onboarding UX

## Goal

Make first login fast and create a useful Home automatically.

## Required inputs/steps

- display name if not already defined;
- choose one bundled 8-bit avatar;
- determine timezone from browser;
- request location permission for weather;
- allow manual location correction/selection.

## Location

Browser geolocation is a convenience, not a requirement.

If denied/unavailable:

- onboarding must continue;
- user can search/select location manually;
- weather must show an actionable unconfigured state until a location exists.

## Completion

On successful onboarding, create:

- one dashboard named `Home`;
- one Search widget;
- one Clock widget using local timezone;
- one Weather widget using chosen location;
- one Bookmarks widget with no required seeded links.

Do not create Travel or Dev.

## Idempotency

Onboarding completion must be safe against refresh/retry and must not create duplicate Home/default widget sets.
