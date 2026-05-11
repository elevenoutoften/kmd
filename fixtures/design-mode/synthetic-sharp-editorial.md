---
name: Sharp Editorial System
description: An editorial design system where all interactive and container elements use 0px border radius. Every button, card, input, and badge is strictly rectangular. The mapper must propagate 0px to all radius tokens.

colors:
  primary: "#57534E"
  primary-hover: "#44403C"
  background: "#FAFAF9"
  surface: "#FFFFFF"
  text-heading: "#1C1917"
  text-body: "#44403C"
  text-muted: "#78716C"
  separator: "#E7E5E4"
  on-primary: "#FFFFFF"

typography:
  display:
    fontFamily: "Georgia, serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
  heading:
    fontFamily: "Georgia, serif"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Georgia, serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6

rounded:
  none: 0px
  default: 0px
  all: 0px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    radius: 0px
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    border: "{colors.separator}"
    radius: 0px
  default-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-body}"
    radius: 0px
  text-input:
    background: "{colors.surface}"
    border: "{colors.separator}"
    radius: 0px
  badge:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-muted}"
    radius: 0px
---

# Sharp Editorial System

A typography-led editorial design where every corner is strictly rectangular. No rounded elements exist — buttons, cards, inputs, badges, and tags all use 0px border radius.

## Design Philosophy

Sharp corners signal editorial authority. Every interactive element, every container, every input field is a clean rectangle. The 0px radius is intentional and system-wide.

## Radius Scale

| Token | Value | Use |
|-------|-------|-----|
| None | 0px | All elements |
| Default | 0px | System default |
| All | 0px | Global override |

## Components

### Buttons
- **Primary**: `{colors.primary}` background, `{colors.on-primary}` text, **0px radius**.
- **Secondary**: Transparent background, `{colors.primary}` text, `{colors.separator}` border, **0px radius**.

### Cards
- **Default**: `{colors.surface}` background, `{colors.text-body}` text, **0px radius**.

### Inputs
- **Text Input**: `{colors.surface}` background, `{colors.separator}` border, **0px radius**.

### Badges
- **Badge**: `{colors.background}` background, `{colors.text-muted}` text, **0px radius**.
