# Phase 0009 — Dev Tools

Change name: `phase-0009-dev-tools`

Status: Planned

Depends on: Phase 0004

## Objective

Add only the two developer widgets currently wanted by the owner.

## Color Converter

Must support bidirectional/coherent conversion between:

- HEX;
- RGB;
- HSL;
- OKLCH.

Expected UX direction:

- editable values;
- visual color preview;
- copy values;
- robust validation;
- conversion logic testable as pure functions.

Exact alpha-channel behavior and gamut-handling details are resolved in the SDD design if needed.

## Password Generator

Must:

- run fully locally;
- use cryptographically secure randomness;
- allow practical configuration such as length and character groups;
- regenerate;
- copy;
- never persist or log generated passwords.

## Must not include

JSON tools, Base64, regex, JWT, hashes, cron, QR, HTTP client, DNS tools, lorem, or other developer utilities.

Those require future specs if ever requested.
