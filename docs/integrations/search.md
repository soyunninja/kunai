# Search Integration

## Scope

Search is an external web search launcher, not an internal application search engine.

## Default

Google is the default engine.

A normal query uses Google unless an alias selects another configured engine.

## User-configurable engines

A search engine definition should include:

- name;
- short alias;
- URL template with one documented query placeholder;
- enabled state/order if needed.

Examples of intended use include YouTube, GitHub, Maps, Reddit, or any external site the user configures.

The product must not hard-code an ever-growing list of providers as a substitute for user configuration.

## Safety

- URL templates must use allowed web protocols.
- Query text must be encoded safely.
- Do not execute `javascript:` or similar schemes.

## Explicit non-goals

- no bookmark search;
- no PocketBase content search;
- no command palette;
- no AI search.
