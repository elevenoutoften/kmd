---
name: Mixed Surface System
description: A design system with alternating light and dark surfaces. Page canvas is light, cards are white, but specialized product tiles use dark surfaces. The mapper must not let dark tile surfaces leak into global light bg/surface.

colors:
  primary: "#0066cc"
  primary-focus: "#0071e3"
  primary-on-dark: "#2997ff"
  ink: "#1d1d1f"
  body-on-dark: "#ffffff"
  body-muted: "#cccccc"
  canvas: "#f5f5f7"
  surface: "#ffffff"
  surface-tile-dark: "#272729"
  surface-hero-dark: "#1a1a1c"
  hairline: "#e0e0e0"
  on-primary: "#ffffff"

typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5

rounded:
  none: 0px
  sm: 8px
  md: 12px
  lg: 20px
  pill: 9999px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
  product-tile-light:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  default-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  product-tile-dark:
    backgroundColor: "{colors.surface-tile-dark}"
    textColor: "{colors.body-on-dark}"
    rounded: "{rounded.none}"
  hero-dark-tile:
    backgroundColor: "{colors.surface-hero-dark}"
    textColor: "{colors.body-on-dark}"
    rounded: "{rounded.none}"
---

# Mixed Surface System

A photography-first interface that alternates light and dark canvases. The page canvas is light parchment, default cards are white, but specialized product tiles and hero sections use dark surfaces.

## Color Roles

### Light Surfaces
- **Page Canvas** (`{colors.canvas}` — #f5f5f7): The default page background.
- **Card Surface** (`{colors.surface}` — #ffffff): Default card and panel background.

### Dark Surfaces
- **Dark Tile** (`{colors.surface-tile-dark}` — #272729): Specialized product tile surface.
- **Hero Dark** (`{colors.surface-hero-dark}` — #1a1a1c): Full-bleed hero section background.

### Accent
- **Action Blue** (`{colors.primary}` — #0066cc): All interactive elements.
- **Focus Blue** (`{colors.primary-focus}` — #0071e3): Keyboard focus ring.
- **Sky Link** (`{colors.primary-on-dark}` — #2997ff): Links on dark surfaces.

## Layout

Tiles alternate light and dark. The color change itself acts as the section divider — no borders or shadows between tiles.

## Components

### Product Tiles
- **Light tile**: `{colors.canvas}` background, `{colors.ink}` text, 0px radius, full-bleed.
- **Dark tile**: `{colors.surface-tile-dark}` background, `{colors.body-on-dark}` text, 0px radius, full-bleed.
- **Hero dark**: `{colors.surface-hero-dark}` background, `{colors.body-on-dark}` text, 0px radius.

### Cards
- **Default card**: `{colors.surface}` (white) background, `{colors.ink}` text, `{rounded.lg}` (20px) radius.

### Buttons
- **Primary**: `{colors.primary}` background, `{colors.on-primary}` text, pill shape.
