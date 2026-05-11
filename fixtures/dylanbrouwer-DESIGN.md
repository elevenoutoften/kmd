# Steep — Design Style Reference

## Overview

> Steep captures a 'white canvas with depth' aesthetic: crisp backgrounds, carefully chosen neutrals, and a warm, inviting accent.

**Theme:** Light | **Density:** Comfortable | **Base unit:** 4px

---

## Layout

- **Theme**: Light
- **Density**: Comfortable
- **Base unit**: 4px
- **Page max-width**: 1280px
- **Section gap**: 80px
- **Card padding**: 20px


## Color Palette

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas | `#ffffff` | `--color-canvas` | Primary page background |
| Ink | `#17191c` | `--color-ink` | Primary text |
| Graphite | `#000000` | `--color-graphite` | Ghost button outlines |
| Warm Mist | `#fbe1d1` | `--color-warm-mist` | Subtle warm background accent |
| Terracotta | `#5d2a1a` | `--color-terracotta` | Accent borders |
| Fog | `#f7f7f8` | `--color-fog` | Secondary surface background |
| Muted Stone | `#4c4c4c` | `--color-muted-stone` | Secondary text |
| Light Steel | `#777b86` | `--color-light-steel` | Muted links |
| Hint of Grey | `#a3a6af` | `--color-hint-of-grey` | Placeholder text |
| Dusk Link | `#8b8c8d` | `--color-dusk-link` | Muted icon strokes |

---

## Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 14px | 1.43 | — | `--text-caption` |
| heading | 22px | 1.18 | — | `--text-heading` |
| heading-lg | 26px | 1 | -0.23px | `--text-heading-lg` |
| display | 44px | 1.1 | -0.66px | `--text-display` |
| display-lg | 64px | 1.1 | -0.96px | `--text-display-lg` |
| body | 15px | 1.6 | — | `--text-body` |
| small | 12px | 1.5 | — | `--text-small` |

---

## Spacing Scale

| Token | Value |
|-------|-------|
| `--spacing-4` | 4px |
| `--spacing-8` | 8px |
| `--spacing-12` | 12px |
| `--spacing-16` | 16px |
| `--spacing-20` | 20px |
| `--spacing-24` | 24px |
| `--spacing-28` | 28px |
| `--spacing-32` | 32px |
| `--spacing-40` | 40px |

---

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 1 | Canvas | `#ffffff` | Primary page background |
| 2 | Fog | `#f7f7f8` | Secondary background |
| 3 | Warm Mist | `#fbe1d1` | Accent background |
| 4 | Card Surface | `#fdfdfd` | Card background |

---

## CSS Variables

```css
:root {
  --color-canvas: #ffffff;
  --color-ink: #17191c;
  --color-graphite: #000000;
  --color-warm-mist: #fbe1d1;
  --color-terracotta: #5d2a1a;
  --color-fog: #f7f7f8;
  --color-muted-stone: #4c4c4c;
  --color-light-steel: #777b86;
  --color-hint-of-grey: #a3a6af;
  --color-dusk-link: #8b8c8d;

  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-40: 40px;

  --radius-card: 24px;
  --radius-image: 12px;
  --radius-input: 16px;
  --radius-button: 9999px;
  --radius-default: 24px;

  --font-sohne: "Sohne", system-ui, sans-serif;
  --font-signifier: "Signifier", serif;

  --text-caption: 14px;
  --text-heading: 22px;
  --text-body: 15px;
  --leading-normal: 1.5;
  --leading-tight: 1.2;
  --tracking-tight: -0.02em;

  --shadow-subtle: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-medium: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-large: 0 10px 15px rgba(0,0,0,0.1);
}
```

```tailwind
@theme {
  --color-canvas: #ffffff;
  --color-ink: #17191c;
  --color-warm-mist: #fbe1d1;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --radius-card: 24px;
  --radius-button: 9999px;
  --font-sohne: "Sohne", system-ui, sans-serif;
  --text-caption: 14px;
  --text-body: 15px;
  --shadow-subtle: 0 1px 2px rgba(0,0,0,0.05);
}
```
