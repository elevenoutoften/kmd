---
version: alpha
name: kmd
description: Premium desktop-first Markdown reader with first-class DESIGN.md support.
colors:
  primary: "#15171A"
  secondary: "#626872"
  tertiary: "#B84E3E"
  neutral: "#F5F7F8"
  surface: "#FFFFFF"
  surface-muted: "#ECEFF3"
  on-primary: "#FFFFFF"
  on-surface: "#15171A"
  border: "#D8DEE6"
  info: "#2563EB"
  success: "#0F8A5F"
  warning: "#B7791F"
  danger: "#B42318"
typography:
  headline-lg:
    fontFamily: "Inter"
    fontSize: 34px
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: 0
  headline-md:
    fontFamily: "Inter"
    fontSize: 24px
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: 0
  body-md:
    fontFamily: "Inter"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.62
    letterSpacing: 0
  body-sm:
    fontFamily: "Inter"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  code-md:
    fontFamily: "SF Mono"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  label-caps:
    fontFamily: "Inter"
    fontSize: 12px
    fontWeight: 650
    lineHeight: 1
    letterSpacing: 0.08em
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 36px
  xxl: 56px
components:
  reader-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  code-block:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 12px
---

# kmd Design System

## Overview

kmd should feel like a premium reader for technical and design documents. The design language is calm, compact, and precise: strong typography, crisp code cards, quiet surfaces, and restrained accent color.

The app should avoid feeling like a browser tab. It should feel like a native reading surface that understands Markdown deeply.

## Colors

The palette uses clear ink text, cool neutral surfaces, and a single warm accent for active interaction.

- **Primary** is used for core text and strong headings.
- **Secondary** is used for metadata, captions, subtle controls, and inactive labels.
- **Tertiary** is the main accent for active controls, links, current outline position, and important interaction.
- **Neutral** is the main page background.
- **Surface** is used for cards, code blocks, popovers, and panels.

## Typography

Typography should prioritize long reading comfort and technical clarity.

- Headings use a sharp modern sans without decorative effects.
- Body text is comfortable and slightly spacious.
- Code uses a true monospace with generous line height.
- Labels are compact and quiet for metadata, code language pills, and token names.

## Layout

The reader uses a centered content column with adaptive margins. Desktop can show sidebars, but the article should remain visually dominant.

The default document max width is 800px. Long technical tables and code blocks may break out into scrollable shells rather than compressing the whole article.

## Elevation & Depth

Depth is subtle. Prefer tonal layers and thin borders over heavy shadows. Dark mode should use layered graphite surfaces rather than pure black.

## Shapes

Rounded corners are controlled. Cards and code blocks use modest radius. Larger sheets and modals use slightly larger radius.

## Components

Reader components should be highly legible:

- Code blocks are cards with language label and copy control.
- Alerts use a thin accent border, icon, and readable title.
- Tables use a contained scrolling shell on narrow screens.
- Token galleries use compact cards with direct copy actions.

## Do's and Don'ts

- Do keep the article content visually central.
- Do make code blocks and tables beautiful.
- Do support dark mode as a first-class experience.
- Do preserve Markdown source fidelity.
- Don't overload the reader with editor chrome.
- Don't use saturated accent color everywhere.
- Don't execute arbitrary document HTML or scripts.
