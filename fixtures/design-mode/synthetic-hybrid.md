---
name: Hybrid Conflict System
description: A compact design fixture with deliberate primary color conflicts.
colors:
  primary: "#FF0000"
---

# Hybrid Conflict System

This document describes a small interface palette assembled from several
handoff formats. The primary token is intentionally repeated across formats so
the pipeline can preserve or report the competing definitions.

## Colors

| Token | Value | Usage |
| --- | --- | --- |
| Primary | #00FF00 | Primary actions and links |
| Surface | #FFFFFF | Cards and panels |
| Text Primary | #111827 | Main readable text |

## Theme Variables

```css
@theme {
  --color-primary: #0000FF;
  --color-accent: #F59E0B;
  --spacing-md: 16px;
}
```

The final reader view should make the conflict visible without losing the
remaining palette context.
