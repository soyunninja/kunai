# Pi + gentle-ai Workflow

## Why this repository uses OpenSpec

The owner explicitly wants file artifacts that survive chat/session boundaries and can be committed to Git.

Therefore SDD changes in this repository use `openspec` mode by default.

Engram may be used as complementary memory if installed, but it must not replace the versioned product/SDD files as the source of truth for this repository.

## Pi project context

Pi loads root `AGENTS.md` automatically when started in the repository.

After changing `AGENTS.md`, restart Pi or reload context according to Pi's runtime behavior.

## gentle-ai project setup

Expected environment:

```bash
gentle-ai install --agent pi
pi
```

Useful status command inside Pi:

```text
/gentle-ai:status
```

## SDD initialization

This repository already contains `openspec/config.yaml` as a deliberate seed.

Run:

```text
/sdd-init
```

If the agent detects existing OpenSpec config and asks before updating it, preserve the project-specific rules/context. It may enrich detected stack/testing information as implementation becomes real.

## Starting a phase

Use the change name defined in the corresponding `docs/phases/*.md` brief.

Example:

```text
/sdd-new phase-0001-foundation
```

Artifact store:

```text
openspec
```

Default delivery/review strategy:

```text
ask-on-risk
```

## Planning sequence

Prefer explicit review between stages:

```text
/sdd-new <change>
/sdd-continue <change>
/sdd-continue <change>
...
```

Do not default to fast-forward planning for the first implementation phases. The owner wants deliberate Spec-Driven Development.

## Apply

Only after proposal/spec/design/tasks are complete and accepted:

```text
/sdd-apply <change>
```

Apply in bounded task groups. Do not use a later-phase brief to opportunistically expand the active change.

## Verify

```text
/sdd-verify <change>
```

Verification is independent evidence against the accepted spec.

Do not mark the phase done because implementation "looks right".

## Archive

After verification/remediation:

```text
/sdd-archive <change>
```

Archived OpenSpec changes are history. Do not rewrite them.

Then update:

- `project/context.md`
- `project/phase-map.md`

## Strict TDD

The documentation pack begins before any real test runner exists, so `openspec/config.yaml` starts with `strict_tdd: false`.

Phase 0001 must establish testing. After its tooling is real, re-run/refresh SDD initialization and enable strict TDD if the detected runner supports the gentle-ai workflow.

## What not to maintain manually

Do not hand-create `.pi/agents/` or gentle-ai SDD chain files in this repository pack. `gentle-pi` owns its project-local SDD assets/runtime behavior.

Do not copy old custom SDD prompts into a competing workflow.
