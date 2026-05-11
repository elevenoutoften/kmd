# UI/UX Design Specification

## Overall experience

The app should feel like a premium document reader, not a web page dumped into a box.

Keywords:

- calm
- compact
- fast
- glass-light surfaces
- strong typography
- generous reading rhythm
- minimal chrome
- excellent dark mode

## App layout

### Desktop

```text
┌──────────────────────────────────────────────┐
│ Toolbar: file name, theme, search, outline    │
├───────────────┬──────────────────────────────┤
│ File sidebar  │ Article reader               │
│ optional      │                              │
│               │ max-width content column      │
│ Outline       │                              │
│ optional      │                              │
└───────────────┴──────────────────────────────┘
```

### iOS

```text
┌─────────────────────────┐
│ Compact top bar          │
├─────────────────────────┤
│ Article reader           │
│ full width with margins  │
│                          │
├─────────────────────────┤
│ Bottom controls hidden   │
│ until scroll/tap         │
└─────────────────────────┘
```

Bottom sheets:

- Outline
- Search
- Settings
- Metadata
- Design tokens

## Reader typography

Default recommendations:

```css
--reader-max-width: 800px;
--reader-body-size: 17px desktop / 16px iOS;
--reader-line-height: 1.62;
--reader-paragraph-gap: 0.95em;
--reader-heading-margin-top: 1.8em;
--reader-heading-margin-bottom: 0.55em;
```

Font strategy:

- Default body: platform serif or modern readable sans depending theme.
- Code: platform monospace.
- Headings: strong sans with tighter letter spacing.
- Give users 3 presets:
  1. Technical Sans
  2. Editorial Serif
  3. GitHub-like

## Theme presets

### Light

- warm off-white background
- ink text
- soft cards
- subtle borders

### Dark

- dark graphite background
- high-contrast but not pure white text
- slightly elevated code/callout surfaces

### Sepia

- warm paper
- brown/ink text
- low-glare long reading

### GitHub

- closer to GitHub Markdown CSS
- useful for README checking

### Design Preview

- generated from `DESIGN.md` tokens

## Block styling

### Headings

- Anchor appears on hover/tap.
- Current section syncs with outline.
- H1 visually distinct but not oversized on mobile.

### Paragraphs

- Comfortable measure.
- No dense wall of text.
- Links should be visibly links without relying only on color.

### Lists

- Clean indentation.
- Nested bullets stay readable.
- Task lists use read-only checkbox style unless editing is enabled later.

### Blockquotes

- Soft left border or inset card.
- Not too heavy.
- Different from alerts.

### Alerts

Five GitHub styles:

| Type | Mood |
|---|---|
| NOTE | neutral blue/info |
| TIP | green/success |
| IMPORTANT | purple/accent |
| WARNING | amber |
| CAUTION | red |

Every alert has:

- icon
- uppercase/small title
- border/accent
- accessible title text

### Code blocks

Visual requirements:

- rounded card
- language label
- copy button
- soft background
- horizontal scroll by default
- wrap toggle
- line-height optimized for code
- no line numbers by default; user setting

### Inline code

- subtle pill background
- does not break line height excessively
- selectable

### Tables

Tables are often the ugliest part of Markdown readers.

Requirements:

- Desktop: full-width within article column, sticky header optional later.
- Mobile: horizontal scroll shell with gradient edge hint.
- Compact cells.
- Alternating row tint only if subtle.
- Support alignment.

### Images

- Fit to column width.
- Preserve aspect ratio.
- Caption from alt text optionally.
- Tap/click opens lightbox.
- SVG allowed only through safe image policy.

### Footnotes

- Superscript links.
- Footnote section visually separated.
- Backlinks supported.

## DESIGN.md mode UX

When a `DESIGN.md` opens:

Desktop default layout:

```text
┌──────────────┬──────────────────────────────┬──────────────┐
│ Sections     │ Rendered design doc          │ Token panel  │
└──────────────┴──────────────────────────────┴──────────────┘
```

iOS:

- Render document normally.
- Floating "Design" button opens token gallery.

Generated visual blocks:

- Color palette grid.
- Typography specimens.
- Spacing ruler.
- Radius cards.
- Component cards.
- Lint report.

## Settings

P0:

- theme
- text size
- line width
- code wrap
- show/hide outline

P1:

- enable Mermaid
- enable math
- raw HTML policy
- GitHub mode
- Design.md auto theme

P2:

- custom CSS
- import/export theme
- default folder

## Keyboard shortcuts

Desktop:

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + O` | Open file |
| `Ctrl/Cmd + F` | Search |
| `Ctrl/Cmd + +` | Increase text |
| `Ctrl/Cmd + -` | Decrease text |
| `Ctrl/Cmd + 0` | Reset text |
| `Ctrl/Cmd + Shift + O` | Toggle outline |
| `Ctrl/Cmd + Shift + C` | Copy current heading link |
| `Esc` | Close overlay |

## Empty state

Message:

> Open a Markdown file to start reading.

Actions:

- Open File
- Open Recent
- Open Folder
- Try Sample Document

## Error states

### Missing image

Show:

- placeholder icon
- unresolved path
- copy path button

### Mermaid error

Show:

- "Diagram could not render"
- error summary
- source expandable

### Parse error

Show:

- fallback source mode
- diagnostics

## Visual QA checklist

Every release should visually check:

- long README
- dense table
- code-heavy file
- phone portrait
- phone landscape
- macOS narrow window
- Windows high-DPI
- dark mode
- sepia mode
- `DESIGN.md` file
