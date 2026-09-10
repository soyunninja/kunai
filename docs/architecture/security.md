# Security Architecture

## Threat priorities

The MVP must protect against:

1. cross-user data exposure;
2. browser exposure of server secrets;
3. insecure provider credential storage;
4. unsafe OAuth token handling;
5. malicious/invalid stored URLs and search templates;
6. corrupted widget configuration/layout crashing the app.

## User isolation

PocketBase rules are mandatory for user-owned collections.

Application code must query within the authenticated owner context.

Never fetch all users' records and filter in the browser.

## Sensitive collections

AI credentials and OAuth secrets/tokens must not be readable through normal browser-side PocketBase rules.

Trusted Nuxt server code performs operations requiring those records.

## AI credentials at rest

If provider credentials are persisted, encrypt them before storage using an application encryption key stored in server environment configuration.

Do not store the encryption key in PocketBase.

Do not return decrypted credentials to the client.

## PocketBase superuser/admin

Never expose superuser credentials in public runtime config or client bundles.

## URLs

Bookmark URLs and search engine URL templates are user-controlled input.

Validate expected protocols and safely encode user queries.

Do not execute arbitrary JavaScript URL schemes.

## Password Generator

- use browser cryptographic randomness;
- do not call server;
- do not log generated passwords;
- do not persist them;
- avoid analytics payloads containing them.

## Logging

Never log:

- passwords;
- auth tokens;
- AI keys;
- OAuth refresh/access tokens;
- generated passwords;
- decrypted secrets.

## External content

Provider strings are data, not trusted markup.

Do not render provider/user data as unsanitized HTML.
