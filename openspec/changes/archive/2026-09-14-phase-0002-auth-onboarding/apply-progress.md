# Apply progress — Phase 0002 Authentication & Onboarding

> Historical evidence snapshot: this document records the state known at the close of task `12.3`. It may be outdated by later Phase 0002 corrections, reviews, and reconciliation. Use [`tasks.md`](./tasks.md) together with [`project/context.md`](../../../../project/context.md) as the authoritative source for current Phase 0002 status.

## 12.3 REFACTOR — recoverable completion responses and retry/resume

### Completed

- Completed task `12.3` and updated its persisted checkbox in [`tasks.md`](./tasks.md) to `- [x]`.
- Added bounded onboarding failure classification: definitive seed conflicts are returned as `409 seed_conflict`; authentication expiry is `401 unauthenticated`; upstream failures are `503 onboarding_unavailable`; bounded retry exhaustion is `503 onboarding_retry_exhausted`.
- Kept completed replays read-only and preserved the existing lost-response/retry convergence behavior; no Home/UI/avatar/geolocation work was added.
- Ensured completion responses, including errors, are `Cache-Control: private, no-store`; expiry clears the application session cookie without returning a completed session.

### Files changed for this task

- `server/utils/api-error.ts`
- `server/utils/onboarding.ts`
- `server/api/onboarding/complete.post.ts`
- `tests/server/onboarding-complete.test.ts`
- `tests/integration/pocketbase/onboarding-concurrency.test.ts`
- `openspec/changes/phase-0002-auth-onboarding/tasks.md`

### Verification

- Safety net: `pnpm vitest run tests/server/onboarding-routes.test.ts tests/integration/pocketbase/onboarding-concurrency.test.ts --reporter=verbose` — PASS, 36 tests.
- RED: `pnpm vitest run tests/server/onboarding-complete.test.ts --reporter=verbose` — expected failures for missing private error caching and raw-upstream mapping; `pnpm vitest run tests/integration/pocketbase/onboarding-concurrency.test.ts --reporter=verbose` — expected persistent-busy test failure.
- Focused final suite: `pnpm vitest run tests/server/onboarding-complete.test.ts tests/server/onboarding-routes.test.ts tests/integration/pocketbase/onboarding-seed.test.ts tests/integration/pocketbase/onboarding-concurrency.test.ts --reporter=verbose` — PASS, 59 tests.
- `pnpm typecheck` — PASS.
- `pnpm lint` — PASS.
- `git diff --check` — PASS.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 12.3 | `tests/server/onboarding-complete.test.ts` | Route/API | 36 focused tests passing | Expected failures recorded for error caching and raw failure mapping | 8 route tests passing | Seed conflict, exhaustion, lost response, unavailable, expiry, and completed replay cases | Extracted bounded onboarding error mapper and kept route handling thin |
| 12.3 | `tests/integration/pocketbase/onboarding-concurrency.test.ts` | Disposable PocketBase integration | 36 focused tests passing | Expected failure recorded for persistent retryable busy state | 33 integration tests passing | One-time busy success and persistent busy exhaustion/reusable-state retry | Retained existing atomic finalization and only clarified retry classification |

### Design deviations

None. The task did not change the 12.2 finalization atomicity or the PocketBase durable completion guard.

### Current status reference

This snapshot does not enumerate current remaining implementation tasks. See [`tasks.md`](./tasks.md) as the OpenSpec task source of record, together with [`project/context.md`](../../../../project/context.md) for the current project-state boundary.

### Workload / PR boundary

This was a single bounded Checkpoint 4A task slice for the `12.3` candidate at the time this snapshot was written. The native review for that `12.3` candidate was subsequently closed for that candidate; later Phase 0002 corrections and native reviews may exist after this document. This snapshot does not attempt to enumerate the latest review target for all of Checkpoint 4A. No commit, push, PR, Home work, or Checkpoint 4B work was performed as part of this `12.3` snapshot.

### Structured status consumed

- Change: `phase-0002-auth-onboarding`; authoritative OpenSpec status: `applyState: ready`.
- Action context: `repo-local`; allowed edit root: `/home/baldboy/desarrollo/soyunninja/kunai.pro`; warnings: none.
- Status after this artifact update: task `12.3` is complete for this historical snapshot; current remaining implementation work is tracked in [`tasks.md`](./tasks.md) and [`project/context.md`](../../../../project/context.md).
