# Nyx Design System

## 1. Visual Theme & Atmosphere

Controlled drama — vast expanses of pure black serve as the canvas for content. The design philosophy is reductive: every pixel exists in service of the information. The interface itself retreats until it becomes invisible.

Typography anchors everything. At display sizes (48-56px), weight 600 with tight line-height (1.07) creates headlines that feel precise and confident. At body sizes (15-17px), tracking loosens slightly and line-height opens to 1.47, creating comfortable reading rhythm.

The entire page is dark. No alternating themes. The accent color is Sky (`#38bdf8`), reserved for interactive elements, scores, and emphasis.

## 2. Color Palette

| Role | Value | Usage |
|------|-------|-------|
| Page Background | `#000000` | Entire page |
| Surface | `#1d1d1f` | Cards, tables, elevated elements |
| Accent | `#38bdf8` | Scores, badges, links, emphasis |
| Accent hover | `#0ea5e9` | Hover/pressed states |
| Accent bg | `rgba(14,165,233,0.15)` | Accent tag/badge backgrounds |
| Positive | `#22c55e` | Success indicators |
| Positive bg | `rgba(34,197,94,0.1)` | Positive tag backgrounds |
| Warning | `#facc15` | Caution indicators |
| Error | `#f87171` | Error/danger indicators |
| Text heading | `#ffffff` | All headings |
| Text body | `rgba(255,255,255,0.85)` | Body text |
| Text muted | `rgba(255,255,255,0.5)` | Secondary text |
| Text dim | `rgba(255,255,255,0.4)` | Tertiary text, labels |
| Separator | `rgba(255,255,255,0.06)` | Row dividers, borders |
| Surface elevated | `rgba(255,255,255,0.05)` | Table headers |

## 3. Typography

- **Font Family:** Inter (Google Fonts import required)
- **Display:** 48-56px, weight 600, line-height 1.07, letter-spacing -0.03em
- **Headings:** 36px, weight 600, letter-spacing -0.02em
- **Subheadings:** 20px, weight 600
- **Body:** 15-17px, weight 400, line-height 1.47
- **Labels:** 11-13px, weight 500-600, uppercase tracking 0.04em
- **Max weight:** 700 (never use 800 or 900)

## 4. Tags & Badges

### Badges (pill shape)
- Accent: `rgba(14,165,233,0.15)` bg, `#38bdf8` text
- Neutral: `rgba(255,255,255,0.1)` bg, `rgba(255,255,255,0.6)` text

### Tags (small pills)
- Accent: `rgba(14,165,233,0.15)` bg, `#38bdf8` text
- Neutral: `rgba(255,255,255,0.08)` bg, `rgba(255,255,255,0.5)` text
- Positive: `rgba(34,197,94,0.1)` bg, `#22c55e` text
- Warning: `rgba(234,179,8,0.1)` bg, `#facc15` text

## 5. Components

### Cards
- Background: `#1d1d1f`, border-radius 20px, padding 28px
- Headings: `#ffffff`
- Body: `rgba(255,255,255,0.5)`
- Highlight variant: add `border: 1px solid rgba(14,165,233,0.2)`

### Tables
- Background: `#1d1d1f`, border-radius 16px
- Header: `rgba(255,255,255,0.05)` bg, `rgba(255,255,255,0.5)` text, uppercase 12px
- Row separators: 1px `rgba(255,255,255,0.06)`
- Body text: `rgba(255,255,255,0.85)`
- Name column: `#ffffff` bold
- Score column: `#38bdf8` bold
- Horizontal scroll wrapper on desktop
- Replaced by card layout on mobile (<768px)

### Mobile Cards
- Background: `#1d1d1f`, border-radius 16px, padding 20px
- Name: `#ffffff` bold
- Score: `#38bdf8`
- Metadata: 2x2 grid (1-col below 640px)
- Labels: `rgba(255,255,255,0.4)` uppercase
- Values: `rgba(255,255,255,0.6)`

### Insight Callout
- Background: `rgba(14,165,233,0.08)`, left border 3px `#38bdf8`
- Text: `rgba(255,255,255,0.8)`
- Strong text: `#38bdf8`

## 6. Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| < 640px | Single column, stacked cards, single-col metadata |
| 640-768px | 2-col grids, mobile cards with 2x2 grid |
| > 768px | Full table, 2-col picks, 3-col verdict |

## 7. Delivery Format

- **Primary:** Self-contained HTML (inline styles, Google Fonts import)
- **Fallback:** PDF via Playwright (printBackground: true, break-inside: avoid)
- **Telegram:** Send HTML as file. No PNG preview for complex reports.
- **Simple data:** ASCII in code blocks, no files needed.

## 8. Anti-Patterns

- NEVER use `rgba(0,0,0,...)` or `#1d1d1f` as text color
- NEVER use `#0ea5e9` for accent text on dark bg (use `#38bdf8`)
- NEVER use `rgba(0,0,0,0.04)` for separators (use `rgba(255,255,255,0.06)`)
- No light sections. No alternating themes.

## 9. Rendering

Render with the project test runner or browser automation stack used by the consuming application.
