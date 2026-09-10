# Widget Size Contract

## Global rule

Every widget type defines a finite list of legal grid sizes.

No freeform pixel dimensions.

Global maximum height: 3 grid rows.

## Why

The size contract lets each widget have intentional render variants rather than merely stretching the same content.

## Required design artifact per widget

Before a new widget is implemented, its SDD design must include a size matrix such as:

```text
Widget: example

2x1  -> compact summary
3x1  -> summary + secondary value
2x2  -> expanded details
4x2  -> expanded details + trend
```

The exact sizes above are illustrative only.

## Requirements

For each legal size, define:

- information shown;
- information intentionally hidden;
- interactive controls available;
- overflow behavior;
- empty/loading/error behavior.

## Resize behavior

A resize interaction must snap only to legal sizes.

If a stored legacy size becomes illegal after a code change, migrate or safely fall back to the widget's default legal size.

## Layout height

No widget may exceed 3 rows even if its content could use more.

If a tool needs more space, use a dedicated expanded view only when a later spec explicitly introduces that concept. Do not assume it now.
