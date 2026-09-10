# Decision Process

## Product decisions

If a missing choice changes user-visible behavior, the SDD phase should ask the owner before implementation.

Record accepted product decisions in:

`project/product-decisions.md`

If the decision changes architecture materially, also add/supersede an ADR.

## Technical decisions

Agents may decide small reversible implementation details within an approved spec.

Agents must ask before changing:

- accepted stack;
- data ownership model;
- dashboard/widget product model;
- secret handling model;
- major UI framework/grid framework;
- product scope;
- a provider when provider behavior/cost materially affects the owner.

## Open decisions

Record unresolved future decisions in:

`project/open-decisions.md`

Do not block Phase 0001 on a Phase 0008 provider choice.

## ADRs

ADRs are immutable historical decisions.

If a decision changes, create a new ADR that supersedes the old one rather than rewriting history.
