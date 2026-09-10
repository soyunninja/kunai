# MVP Scope

## MVP definition

The MVP is a real, usable personal browser startup application, not a design mockup.

It must establish the reusable dashboard/widget architecture and deliver the first useful widgets.

## Included

### Accounts

- PocketBase authentication.
- Multiple accounts supported.
- Strict per-user data isolation.
- No shared data model.
- Public self-registration is not required for the first release.
- First-login onboarding.

### Onboarding

- display name/profile baseline;
- select a bundled 8-bit avatar;
- determine timezone;
- request browser location permission when useful;
- allow manual location correction;
- create default Home dashboard and four default widgets.

### Dashboards

- top tab navigation;
- create;
- switch;
- rename;
- reorder;
- remove according to the resolved Home behavior;
- edit current dashboard;
- settings entry.

### Widget engine

- widget registry;
- instance configuration;
- legal size declarations per widget type;
- max height 3;
- 8-column desktop/tablet landscape grid;
- unrestricted vertical rows;
- add/move/resize/configure/duplicate/remove;
- separate desktop/tablet/mobile layouts;
- safe layout recovery.

### Home/core widget catalog

- Search
- Clock
- Weather
- Bookmarks
- Scratchpad

### Finance widget catalog

- Currency
- Markets

### Calendar

- Google Calendar read-only connection;
- select visible calendars;
- next 3 days widget.

### Travel widget catalog

- Multi-location Weather
- Spanish -> Japanese AI Translate
- Japanese Holidays

Travel may reuse normal Currency and Bookmarks widgets.

### Dev widget catalog

- Color Converter: HEX/RGB/HSL/OKLCH
- Password Generator

### Settings

- profile/avatar;
- default location/timezone;
- appearance: dark/light/system;
- dashboards;
- search engines/aliases;
- weather;
- markets;
- calendar;
- AI provider/model/credentials.

### Quality

- desktop and tablet first-class;
- mobile functional;
- widget-level loading/error handling;
- basic keyboard accessibility;
- touch-safe edit mode;
- no cross-user data exposure;
- no secret exposure to client JS.

## Not included

See `docs/product/non-goals.md`.
