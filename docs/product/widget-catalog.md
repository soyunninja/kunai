# Widget Catalog — MVP

This is the approved catalog direction. Exact legal sizes for each widget are defined during that widget's SDD design.

## General

### Search

Purpose: fast external web search.

Core behavior:

- Google default;
- configurable external engines/aliases;
- no internal search.

### Clock

Purpose: current time display.

Core behavior:

- local time by default;
- supports configuring additional time zones later/within the same instance design if approved by the widget phase;
- Tokyo is an important owner use case.

### Weather

Purpose: one-location weather.

Core behavior:

- current conditions;
- next two days when space permits;
- configurable location;
- default Home instance uses onboarding location.

### Bookmarks

Purpose: simple quick links.

Core behavior:

- name;
- URL;
- optional category;
- website favicon;
- uncategorized links allowed.

### Scratchpad

Purpose: temporary quick text.

Core behavior:

- autosave;
- lightweight Markdown storage;
- `Cmd+Enter` archives current content and starts empty;
- no full notes product.

### Calendar

Purpose: next events.

Core behavior:

- Google Calendar;
- read-only;
- next 3 days;
- selected calendars only.

## Finance

### Currency

Purpose: interactive exchange conversion.

Core behavior:

- amount input;
- source/target currencies;
- EUR/JPY primary use case;
- configurable.

### Markets

Purpose: compact market/watchlist view.

Core behavior:

- multiple symbols in one widget;
- user-managed symbols;
- AAPL explicit use case;
- larger legal sizes may expose more data/visualization after size design approval.

## Travel

### Multi-location Weather

Purpose: compare weather for several travel locations.

Core behavior:

- independent from standard one-location Weather;
- configurable list of places;
- Japan travel is primary use case.

### AI Translate JA

Purpose: Spanish -> Japanese translation for real-world travel interactions.

Core behavior:

- text input;
- Japanese result;
- copy result;
- translate, do not chat;
- provider/model from user AI settings.

### Japan Holidays

Purpose: show upcoming Japanese public holidays.

## Dev

### Color Converter

Purpose: convert/edit colors across:

- HEX;
- RGB;
- HSL;
- OKLCH.

All formats update coherently from the selected source value.

### Password Generator

Purpose: generate secure passwords locally.

Core behavior:

- configurable length/character groups;
- cryptographically secure browser randomness;
- regenerate/copy;
- no persistence.
