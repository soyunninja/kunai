# Product Vision

## One-line vision

A fast, personal, configurable browser startup page that acts as a compact command center and Swiss-army knife for everyday web, travel, and developer workflows.

## Problem

A browser new tab/start page is usually either empty, decorative, or a collection of static bookmarks.

The target product should instead provide useful information and small actions immediately, while remaining visually quiet and highly configurable.

The owner wants a page that can stay open all day and grow into a small personal application without becoming a generic productivity suite.

## Core idea

The application is built around user-owned dashboard tabs and reusable widgets.

A dashboard is a configurable grid surface. A widget is a reusable unit with explicit legal sizes and size-aware rendering.

The same widget type can appear on multiple dashboards or multiple times on one dashboard with independent configuration.

## Product character

The product should feel:

- fast;
- dense;
- technical;
- calm;
- keyboard-friendly on desktop;
- touch-usable on tablet;
- configurable without becoming complicated;
- terminal/TUI-inspired without pretending to be a terminal.

## Primary usage examples

### Home

Immediate access to:

- search;
- local time;
- local weather;
- bookmarks;
- optional scratchpad;
- optional finance/calendar widgets later.

### Travel

A user-created dashboard focused on Japan travel with:

- multiple city weather;
- EUR/JPY;
- Japanese holidays;
- Spanish -> Japanese AI translation;
- useful external links.

### Dev

A user-created dashboard containing only tools the user actually wants, initially:

- color conversion;
- password generation.

## Product growth model

The product should grow by adding new widget types and integrations, not by hard-coding new application sections.

Future large areas such as tasks/projects may be integrated later, but they are intentionally outside the first product cycle.

## Success criteria

The product succeeds when:

- opening a new browser tab gives immediately useful information;
- common external searches and links take fewer actions;
- dashboard layout can be adapted per device;
- widgets remain visually coherent at different sizes;
- external provider failures do not destabilize the dashboard;
- a second account sees only its own data;
- new widgets can be added later without redesigning the entire app.
