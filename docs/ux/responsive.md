# Responsive & Device Layouts

## Priority

1. Desktop
2. Tablet
3. Mobile

Tablet is a first-class target, not merely a shrunk desktop.

## Persisted layouts

Persist separate arrangements for:

- desktop;
- tablet;
- mobile.

A viewport transition selects a device layout but must not silently overwrite another stored layout.

## Desktop

Dense, mouse/keyboard-friendly.

Logical dashboard grid: 8 columns.

## Tablet

Touch-friendly while retaining the compact technical design.

Landscape may use the same 8-column logical grid.

Exact breakpoint values and portrait behavior are resolved in Phase 0004.

## Mobile

Must remain usable for occasional access.

The exact mobile column count is an open technical/UX decision for Phase 0004.

Do not require every desktop layout pattern to remain visually identical on mobile.

## Editing

Drag/resize interactions must be usable with touch on tablet.

If drag and scrolling conflict, edit mode must clearly prioritize deliberate widget manipulation while retaining a usable way to scroll.
