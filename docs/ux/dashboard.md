# Dashboard UX

## Top navigation

The top area should expose user dashboard tabs in a compact form.

Conceptually:

```text
home   travel   dev   +                              edit   settings
----
```

Only `Home` exists by default. Other names are examples/user-created.

## Dashboard tabs

Users can:

- switch;
- create;
- rename;
- reorder;
- remove according to the final Phase 0003 Home behavior.

Tab management must remain compact and not resemble a large admin screen.

## Add dashboard

`+` creates a new empty dashboard.

The creation flow should ask for minimal data, initially just the required name unless Phase 0003 identifies another necessary field.

## Dashboard body

The body is an 8-column logical grid on desktop/tablet landscape.

Vertical length is intentionally unrestricted.

Do not optimize for "everything above the fold" at the expense of widget usefulness.

Users can place high-value information near the top and scroll for additional tools.

## Normal mode

Normal mode prioritizes content and operation.

No permanent drag/resize handles.

## Edit mode

Selecting `edit` exposes subtle editing affordances:

- add widget;
- drag/move;
- resize;
- configure;
- duplicate;
- remove.

Editing controls must not dominate the visual design.

## Widget configuration

Prefer a compact popover or side panel for ordinary widget settings.

Do not send users to a large settings screen for simple per-instance configuration.

## Add widget catalog

Categorize for discovery only:

- General
- Finance
- Travel
- Dev

Any widget can be added to any dashboard.

## Multiple instances

Allowed.

Examples:

- Weather: Almería and Tokyo as separate instances;
- Markets: different symbol groups;
- Bookmarks: different categories/sets;
- Currency: different pairs.

## Empty space

Empty grid cells are acceptable.

Do not force masonry-like compaction if it makes intentional placement unpredictable.

The Phase 0004 design must explicitly decide compaction behavior.
