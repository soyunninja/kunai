# Widget System

## Principle

Widgets are the extension mechanism of the product.

New product capabilities should usually arrive as new widget types or reusable integration services rather than hard-coded dashboard pages.

## Widget registry

The application must have one authoritative registry of widget type definitions.

A widget definition should conceptually include:

- `type`
- catalog category
- display metadata
- configuration contract
- allowed sizes
- default size
- optional minimum capabilities/dependencies
- component/renderer reference

The exact TypeScript shape is designed in Phase 0004.

## Stable type identifiers

Use English stable identifiers such as:

- `search`
- `clock`
- `weather`
- `bookmarks`
- `scratchpad`
- `calendar`
- `currency`
- `markets`
- `travel-multi-weather`
- `travel-ai-translate-ja`
- `travel-japan-holidays`
- `dev-color-converter`
- `dev-password-generator`

Do not encode dashboard names into widget architecture.

## Legal sizes

Each widget definition explicitly declares allowed `{w,h}` pairs.

Global constraints:

- desktop/tablet grid has 8 columns;
- `h <= 3` for every widget;
- arbitrary pixel resizing is not allowed.

A widget's exact size matrix is a product/UX contract resolved in that widget's SDD design.

## Size-aware rendering

A larger legal size may expose more information than a compact legal size.

Examples of intended behavior:

- Weather compact: current conditions.
- Weather larger: current + next 2 days.
- Markets compact: symbols/price/change.
- Markets larger: may include extra fields or compact chart if approved.

Do not squeeze the same full layout into every size.

## Instance configuration

The same widget type may appear multiple times.

Each instance owns its own config unless the setting is intentionally global.

Examples:

- Weather instance A: Almería.
- Weather instance B: Tokyo.
- Currency instance: EUR/JPY.

## Layout validation

On read and write:

1. identify widget type;
2. validate saved/configured size against registry;
3. validate coordinates for active device grid;
4. repair invalid legacy/corrupt layout deterministically;
5. never crash the full dashboard because one layout is invalid.

## Widget states

Integration-backed widgets require explicit:

- loading;
- ready;
- empty;
- error.

If stale caching is introduced, stale status must be visible/defined rather than hidden.

## Edit mode

Available operations:

- configure;
- duplicate;
- remove;
- drag/move;
- resize to a legal size.

Normal mode must not expose accidental layout movement.

## Remove behavior

Removing a widget removes the dashboard instance.

If the widget owns normalized records with historical value (e.g. Scratchpad archived entries), its phase design must explicitly decide retention/deletion behavior instead of cascading blindly.
