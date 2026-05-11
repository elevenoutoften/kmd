# Markdown Dialect Specification

## Goal

Support what users mean by "Markdown like GitHub", while keeping the implementation explicit and safe.

## Baseline

### CommonMark

CommonMark is the core grammar.

Required features:

- ATX headings
- Setext headings
- Paragraphs
- Blockquotes
- Thematic breaks
- Indented code blocks
- Fenced code blocks
- HTML blocks: disabled or sanitized by app policy
- Link reference definitions
- Ordered/unordered lists
- Backslash escapes
- Entities
- Code spans
- Emphasis and strong emphasis
- Inline links and images

### GitHub Flavored Markdown

Required GFM features:

- Tables
- Task list items
- Strikethrough
- Autolink literals
- Footnotes
- Disallowed raw HTML policy compatibility where possible

Notes:

- `remark-gfm` supports autolink literals, footnotes, strikethrough, tables, and task lists.
- `cmark-gfm` is the closest official-style reference implementation.
- GitHub.com performs extra post-processing and sanitization after Markdown-to-HTML conversion; the app should not imply exact GitHub behavior unless those stages are implemented.

## GitHub-adjacent extensions

These are not all part of the original GFM spec but are common in GitHub rendering.

### Alerts

Supported syntax:

```md
> [!NOTE]
> Useful information that users should know.

> [!TIP]
> Helpful advice for doing things better.

> [!IMPORTANT]
> Key information users need to know.

> [!WARNING]
> Urgent information.

> [!CAUTION]
> Risks or negative outcomes.
```

Supported alert types:

- NOTE
- TIP
- IMPORTANT
- WARNING
- CAUTION

Rendering:

- Convert eligible blockquote to `AlertBlock`.
- Preserve nested inline Markdown.
- Use accessible label text, not icon-only meaning.
- Invalid alert type remains a normal blockquote.

### Mermaid

Supported as fenced code block:

````md
```mermaid
flowchart TD
A --> B
```
````

Rendering:

- Replace with sandboxed diagram component.
- Store source for copy/edit.
- Render errors as friendly block.

### Math

Supported:

```md
Inline math: $E = mc^2$

Display math:

$$
E = mc^2
$$
```

Policy:

- Enable with setting.
- Use KaTeX for fast static HTML where possible.
- Never execute arbitrary macros that fetch external resources.

### Front matter

Supported at start of file:

```md
---
title: Example
tags: [docs, markdown]
---
```

Behavior:

- Parse but hide from rendered body.
- Show metadata panel.
- Make front matter available to plugins.
- If file name is `DESIGN.md` or front matter matches DESIGN.md schema, route to Design Mode.

### HTML

Default v1 policy:

- Raw HTML disabled or sanitized.
- Safe subset may include: `details`, `summary`, `kbd`, `sub`, `sup`, `br`, `mark`, `abbr`.
- Unsafe tags removed: `script`, `iframe`, `object`, `embed`, `style`, `link`, `meta`, `form`, `input`, `button` unless explicitly allowed.
- Unsafe attributes removed: event handlers, inline JS URLs, inline styles unless sanitized CSS allowlist exists.

### GitHub references

GitHub-specific references like `#123`, `@user`, commit SHAs, and repository autolinks are not pure Markdown. They require repository context.

v1 behavior:

- Plain autolinks work.
- `@user` and `#123` remain text unless a repository context is configured.
- Later: optional GitHub context plugin for opened repositories.

## Non-GitHub but useful extensions

### Obsidian-style callouts

Optional P2 syntax:

```md
> [!info]
> Content
```

Map aliases to GitHub alert styles where possible.

### Docusaurus admonitions

Optional P2 syntax:

```md
:::note
Content
:::
```

Useful for docs imported from Docusaurus.

### Markdoc

Optional P3.

Markdoc is a Markdown-based documentation format with custom tags and schema validation. It is powerful but changes the authoring model. Do not enable arbitrary Markdoc components in v1.

### MDX

Optional P3/source mode only.

MDX embeds JSX in Markdown. It is unsafe to execute in a reader by default. For this app, MDX should be displayed as Markdown/source unless a trusted project explicitly enables component rendering.

## Rendering compatibility modes

### Reader Mode

Beautiful app-native presentation. Default.

### GitHub Mode

Closer GitHub CSS and behavior for README verification.

### Plain Mode

No extensions except CommonMark. Useful for debugging.

### Design Mode

`DESIGN.md`-aware rendering with token galleries and lint panel.

## Acceptance tests

Use a fixture suite with:

- CommonMark edge cases
- GFM tables
- nested lists
- task lists
- strikethrough
- autolinks
- footnotes
- code fences with unknown language
- images with relative paths
- raw HTML safety cases
- GitHub alerts
- Mermaid valid and invalid diagrams
- math valid and invalid examples
- front matter
- DESIGN.md token references
