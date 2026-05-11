# Feature Specification

## Priority legend

- P0: Required for first usable release
- P1: Required for strong v1
- P2: Valuable after v1
- P3: Experimental

## P0 — Core reader

### Open Markdown files

Supported extensions:

- `.md`
- `.markdown`
- `.mdown`
- `.mkd`
- `.txt`

Acceptance criteria:

- User can open a single file.
- Desktop supports drag-and-drop onto app.
- iOS supports Files picker (later target).
- Recent files list stores local display name and security bookmark where needed.

### Render CommonMark + GFM baseline

Must support:

- headings
- paragraphs
- emphasis
- strong
- inline code
- links
- images
- blockquotes
- ordered/unordered lists
- nested lists
- code fences
- thematic breaks
- tables
- task lists
- strikethrough
- autolink literals
- footnotes

Acceptance criteria:

- Fixture suite compares expected output for core CommonMark/GFM cases.
- Tables and task lists look polished on desktop and mobile.

### Beautiful default reader theme

Default layout:

- Max readable width: 720-860 px.
- Adaptive side padding.
- Text size slider.
- Light/dark/sepia.
- Smooth scroll.
- Sticky compact toolbar only when needed.

Acceptance criteria:

- A long README, a product spec, and a design doc all look good without custom CSS.
- Code blocks and tables do not destroy mobile layout.

### Document outline

Generated from headings.

Acceptance criteria:

- Desktop: collapsible side outline.
- iOS: bottom sheet outline (later target).
- Tapping heading scrolls to that section.
- Current section is highlighted while scrolling.

### Local image support

Acceptance criteria:

- Relative image paths resolve against document location.
- Broken images show a tasteful placeholder with path.
- Tapping image opens zoom/lightbox.

## P1 — GitHub-like polish

### GitHub alerts

Syntax:

```md
> [!NOTE]
> Useful information.

> [!TIP]
> Helpful advice.

> [!IMPORTANT]
> Essential detail.

> [!WARNING]
> Urgent info.

> [!CAUTION]
> Risk or negative outcome.
```

Acceptance criteria:

- Render as distinct callout cards with icon, title, color accent.
- Multiline content supports inline Markdown.
- Nested alerts are not supported in v1; display as normal blockquote if invalid.

### Code highlighting

Use Shiki or equivalent.

Acceptance criteria:

- Language inferred from fenced code info string.
- Unknown language falls back to plain monospace.
- Copy button appears on hover/tap.
- Line wrapping toggle.
- Optional line numbers.

### Mermaid diagrams

Syntax:

```md
```mermaid
flowchart TD
A --> B
```
```

Acceptance criteria:

- Renders offline.
- Error state shows source and readable error.
- External resources disabled.
- Large diagrams scroll/zoom.

### Math

Support:

- Inline math: `$x^2$`
- Display math: `$$x^2$$`

Acceptance criteria:

- Render with KaTeX or MathJax.
- Copy source option.
- Disabled by default if performance/security concerns arise, but can be enabled in settings.

### Front matter

Support YAML/TOML/JSON front matter display.

Acceptance criteria:

- Front matter does not appear as ugly code at top by default.
- User can expand "Metadata" panel.
- For `DESIGN.md`, YAML is parsed as design tokens.

## P1 — DESIGN.md support

See `05-design-md-support.md`.

Summary:

- Detect `DESIGN.md`.
- Parse YAML front matter.
- Render token galleries.
- Validate structure.
- Apply token theme preview.
- Export parsed token JSON.

## P2 — Power reader

### Search inside document

- Highlights matches.
- Keyboard shortcuts.
- Match count and next/previous.

### Folder mode

- Open folder.
- Sidebar file tree.
- Search file names.
- Remember last opened file.

### Export

- Export rendered HTML.
- Export PDF.
- Copy rendered selection as HTML.
- Copy Markdown source.

### Custom themes

- Theme files as CSS variables.
- Import/export theme.
- Create theme from `DESIGN.md`.

### Print layout

- Page-aware typography.
- Code blocks avoid awkward splitting where possible.
- User can include/exclude outline.

## P3 — Later experiments

- Lightweight editor.
- Side-by-side source and preview.
- Markdown lint hints.
- AI summary of large docs.
- Local semantic search.
- Git repository context for issue/PR links.
- Mobile widgets for pinned docs.
- Agent-readable "reader profile" export.
