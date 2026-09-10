# Settings UX

## Direction

Settings should keep the same terminal-like visual language as the dashboard.

Avoid a generic enterprise admin panel.

## Sections

### Profile

- display name;
- avatar selection;
- timezone;
- default location.

### Appearance

- dark (default);
- light;
- system.

### Dashboards

- create;
- rename;
- reorder;
- remove according to Phase 0003 rules.

### Search

- Google default;
- manage external engines;
- aliases;
- order/enabled state where needed.

### Weather

- default/onboarding location convenience;
- provider-specific user configuration only if the chosen provider genuinely requires it.

### Markets

- manage tracked symbols/watchlist;
- symbol order;
- optional display labels.

### Calendar

- connect/disconnect Google;
- choose visible calendars;
- read-only status/scopes.

### AI

- provider;
- model;
- credentials;
- optional endpoint only if supported by the selected provider contract.

The UI must never reveal a previously stored full secret value.

## Widget settings vs global settings

Use widget configuration for instance-specific choices.

Use Settings for central/global personal configuration.

Do not duplicate the same setting in both places without a clear precedence rule.
