# Visual Direction

## Overall aesthetic

Terminal/TUI-inspired web application.

The product should feel like a precise technical workspace rather than a generic SaaS dashboard.

The reference screenshots supplied by the owner are preserved under `docs/reference/visual/`.

They are inspiration for:

- dense grid composition;
- near-black/dark surfaces;
- thin separators/borders;
- monospaced typography;
- restrained color;
- compact controls;
- data-first presentation;
- limited ornament.

Do not copy a reference layout literally.

## Typography

Use monospaced typography for almost all interface text.

Avoid oversized display typography.

Text should remain readable on tablet.

A secondary font is not part of the MVP unless readability testing clearly requires one.

## Theme

Default: dark.

Also support:

- light;
- system.

Dark mode should be treated as the primary visual design, not a simple color inversion afterthought.

## Surfaces

Prefer:

- flat panels;
- 1px-style separators/borders;
- subtle hierarchy through spacing and text weight;
- restrained corner radius;
- little or no shadow.

Avoid:

- glassmorphism;
- neon cyberpunk styling;
- heavy gradients;
- large rounded consumer cards;
- excessive iconography.

## Color

Color should communicate information or interaction state.

Good uses:

- positive/negative market movement;
- focus;
- warning/error;
- active tab;
- selected control.

The interface must remain understandable without relying on color alone.

## Avatars

The owner will provide a curated set of 8-bit avatars.

The app displays those bundled assets and stores a stable avatar key.

Do not implement arbitrary image upload in MVP.

## Motion

Use short functional transitions only.

Do not animate live data for decoration.

Respect reduced-motion preferences.
