---
name: Frosted Card System
description: A design system featuring frosted glass cards. Light cards use a translucent white overlay on a light page, while dark surfaces use near-black. The frosted card surface must not be confused with the global dark surface or light page background.

colors:
  primary: "#6366F1"
  primary-hover: "#4F46E5"
  page-bg: "#F0EEFF"
  surface: "#FFFFFF"
  frosted-card-light: "rgba(255,255,255,0.72)"
  surface-dark: "#1a1a2e"
  frosted-card-dark: "rgba(26,26,46,0.85)"
  text-heading: "#1E1B4B"
  text-body: "#4C4578"
  text-on-dark: "#E0E0FF"
  separator: "rgba(99,102,241,0.12)"
  on-primary: "#FFFFFF"

typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 44px
    fontWeight: 600
    lineHeight: 1.1
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5

rounded:
  sm: 8px
  md: 16px
  lg: 24px
  pill: 9999px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  frosted-card:
    backgroundColor: "{colors.frosted-card-light}"
    textColor: "{colors.text-heading}"
    rounded: "{rounded.lg}"
  frosted-card-dark:
    backgroundColor: "{colors.frosted-card-dark}"
    textColor: "{colors.text-on-dark}"
    rounded: "{rounded.lg}"
  default-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.md}"
---

# Frosted Card System

A calm, glassmorphic design system where cards use frosted translucent overlays. Light cards float over a soft lavender page with a white translucent overlay. Dark surfaces use a near-black translucent layer.

## Color Roles

### Page Background
- **Page BG** (`{colors.page-bg}` — #F0EEFF): The soft lavender page canvas.

### Card Surfaces
- **Default Card** (`{colors.surface}` — #FFFFFF): Solid white card background.
- **Frosted Card Light** (`{colors.frosted-card-light}` — rgba(255,255,255,0.72)): Translucent white overlay for frosted glass effect on light pages.
- **Surface Dark** (`{colors.surface-dark}` — #1a1a2e): Solid dark surface for dark mode sections.
- **Frosted Card Dark** (`{colors.frosted-card-dark}` — rgba(26,26,46,0.85)): Translucent near-black overlay for frosted glass effect on dark surfaces.

### Accent
- **Primary** (`{colors.primary}` — #6366F1): All interactive elements.
- **Primary Hover** (`{colors.primary-hover}` — #4F46E5): Hover states.

## Frosted Glass Pattern

Frosted cards use translucent backgrounds with backdrop-filter blur. The light frosted card is a white-tinted overlay — it must NOT be treated as a dark surface. The dark frosted card is a near-black overlay — it must NOT be treated as the global page background.

## Components

### Cards
- **Frosted Card**: `{colors.frosted-card-light}` translucent white overlay, `{colors.text-heading}` text, `{rounded.lg}` (24px) radius.
- **Frosted Card Dark**: `{colors.frosted-card-dark}` translucent near-black overlay, `{colors.text-on-dark}` text, `{rounded.lg}` radius.
- **Default Card**: `{colors.surface}` solid white, `{colors.text-body}` text, `{rounded.md}` radius.
