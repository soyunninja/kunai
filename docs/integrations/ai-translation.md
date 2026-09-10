# AI Translation Integration

## Product use case

A Travel widget accepts Spanish text and returns Japanese suitable for showing/copying during travel.

The tool is a translator, not a chatbot.

## Initial behavior

- input language: Spanish;
- output language: Japanese;
- translate action;
- result display;
- copy result;
- concise failure state.

A small tone control such as polite/natural may only be added if explicitly included in the Phase 0008 OpenSpec spec.

## User AI settings

Settings include:

- provider;
- model;
- credential;
- optional endpoint/base URL if the selected provider design requires it.

## Credential rule

A ChatGPT/consumer subscription must not be assumed to provide API usage for this app.

The integration uses supported provider API credentials or another explicitly supported API mechanism.

Stored credentials:

- are encrypted before PocketBase persistence;
- cannot be read by normal browser PocketBase access;
- are decrypted only in trusted server code;
- are never returned in full after storage.

## Provider scope

Exact initial provider support is resolved in Phase 0008.

Do not implement many providers speculatively.

The architecture should keep provider-specific calls behind an adapter.

## Prompt/output rule

The server instruction should request only the translation needed for the UI.

Avoid explanatory essays unless the future spec explicitly adds them.
