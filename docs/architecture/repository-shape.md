# Target Repository Shape

This is a direction, not proof that these directories are already implemented.

A conventional Nuxt 4 repository should remain preferable to an unnecessary monorepo.

Expected shape after foundation work may resemble:

```text
.
├── app/                     # Nuxt application UI
│   ├── components/
│   ├── composables/
│   ├── layouts/
│   ├── pages/
│   └── ...
├── server/                  # Nuxt/Nitro server routes and provider services
├── shared/                  # shared typed contracts if genuinely useful
├── public/
│   └── avatars/             # bundled 8-bit avatars supplied by owner
├── pb_migrations/           # versioned PocketBase migrations if chosen
├── pb_hooks/                # PocketBase hooks only if required
├── project/                 # durable project context
├── docs/                    # product/architecture/phase docs
├── openspec/                # gentle-ai SDD artifacts
├── AGENTS.md
└── package.json
```

## PocketBase runtime data

`pb_data/` must never be committed.

## Do not force structure prematurely

Phase 0001 may refine exact folders according to Nuxt 4 conventions and chosen test tooling.

Do not create layers or packages solely because a future feature might need them.
