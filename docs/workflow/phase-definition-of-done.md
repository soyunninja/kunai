# Phase Definition of Done

A phase is not Done until all applicable conditions below are true.

## Planning

- OpenSpec proposal exists and matches the phase brief.
- Requirements/spec exists.
- Design exists for architecture/UX decisions needed by the phase.
- Tasks exist and are bounded enough to implement/review safely.
- Blocking owner decisions are resolved.

## Implementation

- Required functionality is implemented.
- Deferred functionality was not silently added.
- User isolation/security constraints are respected.
- New widget types have explicit legal size contracts.
- External integrations use normalized boundaries.

## Validation

- tests/typecheck/lint/build pass as applicable;
- manual UI validation completed where visual/touch behavior matters;
- tablet behavior checked for dashboard interaction phases;
- dark theme checked for every UI phase;
- light/system checked once appearance behavior exists.

## Verification

- `/sdd-verify` completed;
- no unresolved critical findings;
- warning-level items are either fixed or explicitly accepted/documented.

## Documentation

- implementation truth and docs agree;
- `project/context.md` updated after verification;
- `project/phase-map.md` status updated;
- architecture changes have ADRs when necessary.

## Archive

- OpenSpec change archived.
