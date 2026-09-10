# External Integration Architecture

## Integrations in MVP

- weather;
- currency exchange;
- market data;
- Google Calendar;
- AI translation;
- Japanese public holidays.

Search engines and bookmark navigation are external navigation, not data integrations in the same sense.

## Provider adapter rule

Each integration has an app-level normalized contract.

Widget/UI code should not depend directly on provider-specific payloads.

This makes provider replacement possible without rewriting widgets.

## Server boundary

Use Nuxt server routes/services whenever an integration involves:

- secret API keys;
- OAuth tokens;
- server-only credentials;
- normalization that should be centralized;
- rate limiting;
- caching shared across requests;
- provider CORS restrictions.

A public no-secret provider may still use the server boundary for consistency if justified.

## Error strategy

Provider failures are isolated to the relevant widget.

Normalized errors should distinguish at minimum where useful:

- temporary provider/network failure;
- invalid configuration;
- authentication/credential failure;
- rate limit;
- no data.

Never display raw secret-bearing provider errors to users.

## Caching

Do not add caching without defining:

- cache location;
- TTL;
- stale behavior;
- invalidation;
- user/provider scoping.

Cache is not user-domain history.

## Provider selection

Providers are deliberately not selected globally in advance where the product owner has not chosen one.

Each provider is selected/reviewed in the phase that first needs it.
