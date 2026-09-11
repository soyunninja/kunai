# ADR 0008 — PocketBase migration workflow

Status: Accepted

## Decision

Future approved PocketBase schema and rule changes use version-controlled JavaScript migration source under root `pb_migrations/`. Phase 0001 creates no schema, collection, owner rule, or placeholder migration.

## Workflow

Use the pinned PocketBase binary documented in [local setup](../development/local-setup.md), against the intended disposable local database:

```sh
pocketbase migrate create <name> --dir=./pb_data --migrationsDir=./pb_migrations
pocketbase migrate up --dir=./pb_data --migrationsDir=./pb_migrations
```

Review the generated migration in timestamp order before committing it. Every approved change needs deliberate forward behavior and a reviewed reverse/recovery path. Test migrations on a disposable database; changes involving user-owned data must also test PocketBase owner rules. Back up valuable data before applying changes and document recovery expectations with the owning feature. Do not casually roll back a valued database.

## Repository discipline

Commit meaningful migration source only. Never commit `pb_data/`, database files, uploaded content, PocketBase binaries, credentials, generated admin output, placeholder migrations, initial schemas, collections, or owner rules without a later approved feature specification.

This decision defines future migration discipline only; it is not a production deployment procedure and does not authorize Phase 0001 database changes.
