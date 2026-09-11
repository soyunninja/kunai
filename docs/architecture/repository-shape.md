# Target Repository Shape

Phase 0001 implements a conventional single Nuxt application without a monorepo or speculative feature layers:

```text
.
├── app/                     # neutral Nuxt shell, composable, and global CSS
├── server/                  # Foundation endpoint configuration validation plugin
├── tests/                   # Vitest node and Nuxt/happy-dom behavior tests
├── pb_migrations/           # future meaningful PocketBase migrations only
├── docs/                    # product and engineering documentation
├── openspec/                # SDD artifacts
├── AGENTS.md
└── package.json
```

No `pages/`, `layouts/`, components, widget directories, data-access client, PocketBase SDK, or product data are created in this phase. Add structure only when an approved later feature requires it.

## PocketBase runtime data

`pb_data/` is ignored and must never be committed. PocketBase binaries, credentials, generated admin output, and placeholder migrations are likewise not repository content.
