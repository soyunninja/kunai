# Accepted Product Decisions

This file records product decisions already confirmed by the owner.

Do not ask again unless a later requirement conflicts with them.

## Product shape

- The application is a browser startup page / personal command center.
- It is operational, not merely informational.
- Multiple user accounts are supported.
- Each user has a completely private personal space.
- Users do not share dashboards or data in the MVP.
- A user may own multiple dashboard tabs.

## New-user defaults

A new user receives only one dashboard named `Home`.

Home initially contains:

- Search;
- Local Clock;
- Local Weather;
- Bookmarks.

Travel and Dev are not created automatically.

## Dashboard

- Dashboard tabs live in the top navigation.
- The `+` action creates a new dashboard.
- Tabs can be reordered.
- `edit` edits the current dashboard.
- `settings` opens terminal-inspired settings.
- Vertical scrolling is normal and unrestricted.

## Grid

- Desktop/tablet horizontal grid: 8 columns.
- Widget height maximum: 3 rows.
- Each widget type explicitly defines which sizes it supports.
- The same widget type may be instantiated multiple times.
- Widget instances have independent configuration.
- Desktop, tablet, and mobile layouts are stored independently.

## Search

- Search is included on the default Home dashboard.
- Google is the default engine.
- Users can configure additional external engines and aliases.
- Search is not an internal universal app search in the MVP.

## Clock

- Default Clock shows the user's local time.
- A clock widget can later be configured with additional zones such as Tokyo.

## Weather

- Default Home weather is the user's location.
- Browser geolocation may be used during onboarding, with manual correction.
- Standard Weather focuses on one location.
- It may show the next two days when size permits.
- Multi-location weather is a separate widget intended for travel.

## Bookmarks

- Bookmarks are intentionally simple.
- A bookmark has name + URL and optional category.
- Uncategorized links are allowed.
- Icon is derived from the website favicon.
- If no favicon works, render a text fallback.
- Bookmark lookup is not part of the Search widget.

## Scratchpad

- Scratchpad is an optional widget, not part of default Home.
- It autosaves.
- No explicit Save button.
- Lightweight Markdown storage is acceptable.
- `Cmd+Enter` archives the current scratchpad entry and starts a new empty one.
- This is not a full notes application.

## Finance

- Currency conversion is interactive inside the widget.
- EUR/JPY is the primary use case.
- The currency widget should remain configurable.
- Markets is user-configurable.
- One Markets widget may display multiple symbols.
- Apple (`AAPL`) is an explicit example use case.

## Google Calendar

- Read-only in the MVP.
- Shows upcoming events for the next 3 days.
- User selects which Google calendars are visible in Settings.
- No email integration in the MVP.

## Travel

Travel functionality is primarily for the owner's Japan use case.

Included direction:

- multi-location weather;
- reusable EUR/JPY currency widget;
- quick external links/bookmarks;
- Spanish -> Japanese AI translation;
- Japanese public holidays.

Explicitly not needed now:

- Spain/Japan time converter;
- phrase list;
- train route planner;
- Japan event/matsuri feed (deferred; owner already has a calendar source for later).

## AI translation

- Translation input is Spanish and output is Japanese for the initial Travel tool.
- AI settings include provider, model, and credentials.
- AI credentials belong to the user but must be handled server-side after storage.
- The tool should translate rather than act as a conversational chatbot.

## Dev

Initial Dev scope contains only:

1. Color Converter
2. Password Generator

Color Converter supports:

- HEX
- RGB
- HSL
- OKLCH

Password Generator:

- runs locally in the browser;
- uses cryptographically secure randomness;
- never persists generated passwords.

## Profile / appearance

- Avatar is selected from bundled owner-provided 8-bit avatars.
- Arbitrary photo upload is not required.
- Appearance defaults to dark.
- Light and system modes are available.
- Visual style is mostly monospaced and terminal/TUI-inspired.

## Device priority

Primary:

- desktop;
- tablet.

Mobile:

- supported;
- lower usage priority;
- should remain functional.
