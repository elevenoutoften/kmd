---
name: Dark-Only System
description: A dark-only design system. The entire page is black, surfaces are near-black, and the accent is sky blue. There is no light theme intent — all tokens are dark by design. The mapper must not invert dark tokens into light equivalents or use accent-bg as page background.

colors:
  page-background: "#000000"
  surface: "#1d1d1f"
  surface-elevated: "rgba(255,255,255,0.05)"
  accent: "#38bdf8"
  accent-hover: "#0ea5e9"
  accent-bg: "rgba(14,165,233,0.15)"
  positive: "#22c55e"
  positive-bg: "rgba(34,197,94,0.1)"
  warning: "#facc15"
  error: "#f87171"
  text-heading: "#ffffff"
  text-body: "rgba(255,255,255,0.85)"
  text-muted: "rgba(255,255,255,0.5)"
  text-dim: "rgba(255,255,255,0.4)"
  separator: "rgba(255,255,255,0.06)"

typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 52px
    fontWeight: 600
    lineHeight: 1.07
    letterSpacing: "-0.03em"
  heading:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.47

rounded:
  sm: 8px
  md: 12px
  lg: 20px
  pill: 9999px

components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#000000"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.lg}"
  badge-accent:
    backgroundColor: "{colors.accent-bg}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
---

# Dark-Only Design System

Controlled drama — vast expanses of pure black serve as the canvas for content. The entire page is dark. No alternating themes.

## Color Palette

| Role | Value | Usage |
|------|-------|-------|
| Page Background | `{colors.page-background}` (#000000) | Entire page canvas |
| Surface | `{colors.surface}` (#1d1d1f) | Cards, tables, elevated elements |
| Accent | `{colors.accent}` (#38bdf8) | Interactive elements, scores, emphasis |
| Accent Hover | `{colors.accent-hover}` (#0ea5e9) | Hover states |
| Accent BG | `{colors.accent-bg}` (rgba(14,165,233,0.15)) | Badge/tag backgrounds |
| Text Heading | `{colors.text-heading}` (#ffffff) | All headings |
| Text Body | `{colors.text-body}` (rgba(255,255,255,0.85)) | Body text |
| Text Muted | `{colors.text-muted}` (rgba(255,255,255,0.5)) | Secondary text |
| Separator | `{colors.separator}` (rgba(255,255,255,0.06)) | Row dividers |

## Anti-Patterns

- NEVER use `rgba(0,0,0,...)` as text color on dark backgrounds.
- No light sections. No alternating themes.
- Accent-bg is a tint for badges only — never a page or card background.
