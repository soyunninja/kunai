# Review Checklist

Use this checklist during gentle-ai review/verification.

## Scope

- Does the implementation match the active OpenSpec change?
- Did unrelated future features slip in?
- Did the implementation invent product behavior?

## User isolation

- Can another normal user list/view/update/delete this record?
- Are PocketBase rules owner-scoped?
- Is filtering performed server/database-side rather than after data reaches the client?

## Secrets

- Any provider key in public runtime config?
- Any token/key logged?
- Any sensitive PocketBase collection readable from client?
- Any AI/OAuth secret returned after storage?

## Widget system

- Is widget type registered centrally?
- Are legal sizes explicit?
- Is `h <= 3` enforced?
- Are layouts validated on read/write?
- Does invalid stored config fail locally rather than crash dashboard?
- Does normal mode prevent accidental layout changes?

## Responsive UX

- desktop;
- tablet landscape;
- tablet touch interaction;
- mobile basic use;
- no cross-device layout overwrite.

## Visual direction

- mostly monospaced;
- compact;
- dark-first;
- restrained borders/color;
- not generic SaaS card styling.

## External data

- provider payload normalized;
- timeouts/errors handled;
- rate/freshness semantics honest;
- one provider failure does not break whole dashboard.

## Tests

- pure transformations tested;
- access/security behavior tested where practical;
- layout legality tested;
- failure paths tested;
- no tests merely mirror implementation details.
