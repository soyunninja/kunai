# Phase 0008 — Travel Widgets

Change name: `phase-0008-travel-widgets`

Status: Planned

Depends on: Phase 0005; uses integration/security foundation

## Objective

Add Japan-focused widgets the owner can place on a user-created Travel dashboard.

No Travel dashboard is auto-created.

## Multi-location Weather

- configurable list of travel locations;
- optimized for comparing several places;
- separate widget type from standard Weather;
- reuse normalized weather integration where practical.

## AI Translate JA

- Spanish input;
- Japanese output;
- copy result;
- translation-focused response;
- provider/model/credentials in Settings > AI;
- stored credentials encrypted/server-only;
- no assumption that a consumer ChatGPT subscription provides API access.

## Japan Holidays

- upcoming official Japanese public holidays;
- reliable source chosen in design;
- compact display.

## Reuse

Travel can use ordinary Currency and Bookmarks widget instances. Do not create duplicate Travel-only currency/bookmark implementations.

## Required design work

- initial AI provider scope;
- AI credential storage design;
- Japanese holiday source;
- legal size matrix for each Travel widget.

## Explicitly deferred

- events/matsuri feed;
- train routing;
- Spain/Japan time converter;
- phrasebook;
- itinerary planning.
