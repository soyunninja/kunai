# Open Decisions

Open decisions are resolved only when their phase needs them.

Do not block earlier phases on later provider choices.

| Decision | Needed by | Status | Notes |
|---|---|---|---|
| Final product name | Release/branding | Non-blocking | Working title remains Browser Startup Page. |
| Exact breakpoint pixel values | Phase 0004 | Open | Product requires desktop/tablet/mobile layouts; implementation breakpoints can be proposed. |
| Exact legal size matrix per widget | Each widget phase | Open by design | Every widget MUST declare legal sizes during its design before implementation. |
| Weather data provider | Phase 0005 | Open | Prefer reliable API and normalized server adapter. |
| FX data provider | Phase 0006 | Open | Must support EUR/JPY reliably. |
| Market data provider | Phase 0006 | Open | Must support user-entered symbols such as AAPL and multiple symbols per widget. |
| Google Calendar OAuth deployment details | Phase 0007 | Open | Read-only scopes only. |
| AI provider(s) for first release | Phase 0008 | Open | Settings model supports provider/model/credentials; first implementation scope must be approved. |
| Japanese holiday data source | Phase 0008 | Open | Must be reliable for Japanese public holidays. |
| Whether Home may be deleted/renamed | Phase 0003 | Open | Dashboard removal exists; exact Home protection behavior was not explicitly fixed. |
| Exact PocketBase auth token/session strategy in Nuxt SSR/client | Phase 0002 | Open technical decision | Must be secure and consistent with PocketBase/Nuxt architecture. |

## Current blockers

None for Phase 0001.
