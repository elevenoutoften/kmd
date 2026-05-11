# Research Summary

## 1. Markdown baseline

The practical baseline should be **GitHub Flavored Markdown (GFM)** rather than "classic Markdown".

Why:

- Many users expect tables, task lists, strikethrough, autolink literals, and footnotes to work.
- GitHub has a formal GFM spec built as a strict superset of CommonMark.
- GitHub's reference implementation is `cmark-gfm`, a fork of CommonMark's `cmark`.
- GFM alone is not everything GitHub does. GitHub also post-processes, sanitizes, links references, highlights code, renders diagrams, and applies CSS.

Implementation implication:

- The app should advertise "GitHub-compatible Markdown rendering" only where tested.
- The app should define exact supported extensions instead of claiming "exact GitHub rendering" unless using `cmark-gfm` plus equivalent post-processing.

## 2. Google's DESIGN.md

Google Labs recently open-sourced a draft `DESIGN.md` specification from Stitch.

The important finding: `DESIGN.md` is **not** an alternate Markdown layout language. It is a way to describe a visual identity to AI coding agents.

A `DESIGN.md` file contains:

- Optional YAML front matter with machine-readable tokens.
- Markdown body with human-readable design rationale.
- Canonical sections such as Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, and Do's/Don'ts.
- Token references using `{path.to.token}`.
- A CLI package, `@google/design.md`, with `lint`, `diff`, `export`, and `spec`.

For this app, `DESIGN.md` support should mean:

1. Render `DESIGN.md` as a beautiful Markdown document.
2. Detect and parse its YAML design-token front matter.
3. Show automatic visual galleries for colors, typography, spacing, radius, and component tokens.
4. Validate broken references, duplicate canonical sections, missing typography, contrast failures, and section order.
5. Optionally apply the document tokens as a live preview theme.

## 3. Cross-platform app stack

Recommended: **Tauri 2 + TypeScript frontend + Rust backend**.

Rationale:

- Tauri 2 supports Windows, macOS, iOS, Android, and Linux from one codebase.
- It uses the system WebView rather than bundling Chromium.
- Rust is strong for file access, parsing helpers, local indexing, and cache management.
- A WebView makes high-quality Markdown layout easier than rebuilding tables, code highlighters, Mermaid diagrams, math, and token-driven CSS in every native UI toolkit.

Alternatives considered:

| Stack | Strength | Problem |
|---|---|---|
| SwiftUI + MarkdownUI | Excellent for macOS/iOS native feel | Windows requires separate renderer/app |
| Flutter | Good single codebase | Markdown/HTML/code rendering usually becomes WebView-heavy anyway |
| React Native | iOS/macOS/Windows possible | Desktop maturity and Markdown table/code fidelity are riskier |
| Electron | Rich web stack | Not compact |
| Qt | Mature desktop | iOS and modern Markdown web features need extra work |
| .NET MAUI | Windows/macOS/iOS possible | Markdown rendering ecosystem less direct for advanced docs |

## 4. Parser/rendering strategy

There are two viable approaches.

### Option A — Web AST pipeline

Use:

- `micromark` / `remark` / `remark-gfm`
- `remark-frontmatter`
- custom GitHub-alert transformer
- `remark-math` + `rehype-katex`
- Mermaid renderer for `mermaid` code fences
- Shiki for syntax highlighting
- `rehype-sanitize` or DOMPurify for safety
- CSS variables generated from app theme or `DESIGN.md` tokens

Best for a polished reader app because it is easy to customize visual output.

### Option B — `cmark-gfm` core

Use `cmark-gfm` or bindings for strict GFM parsing, then post-process HTML.

Best if the top goal is exact GFM conformance and performance.

Recommended hybrid:

- Start with the web AST pipeline for velocity and visual control.
- Keep `cmark-gfm` fixture tests as compatibility oracle.
- If exact compatibility becomes critical, move block parsing to `cmark-gfm` but keep the same renderer/theme layer.

## 5. Feature target

Minimum lovable reader:

- Open `.md`, `.markdown`, `.mdown`, `.mkd`, `.txt`.
- Folder/sidebar file browser.
- Beautiful reading mode.
- GitHub-style Markdown.
- Dark/light/sepia themes.
- Table of contents from headings.
- Code blocks with syntax highlighting and copy button.
- Tables that scroll horizontally on small screens.
- GitHub alerts.
- Local images and relative links.
- Safe HTML handling.
- iCloud/Files integration on iOS (later target).
- Drag-and-drop on desktop.

Power-reader layer:

- Mermaid diagrams.
- Math.
- Footnotes.
- Front matter display.
- Search within document.
- Recent files.
- Export to PDF/HTML.
- `DESIGN.md` visualizer and validator.
- Token-driven preview themes.

## 6. Biggest risks

| Risk | Mitigation |
|---|---|
| Raw HTML XSS in WebView | Default: raw HTML disabled or sanitized with a strict allowlist |
| Mermaid unsafe content | Render in sandboxed iframe or worker; disable external resources |
| "Exact GitHub" claims | Maintain fixture suite and use precise compatibility language |
| iOS file system limitations | Design around security-scoped files, Files app picker, imported folder bookmarks |
| Huge Markdown files | Incremental parse cache, outline pre-pass, virtualized blocks for very large docs |
| DESIGN.md alpha spec changes | Version the adapter and keep unknown content preserved |
