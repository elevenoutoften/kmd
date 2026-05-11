# kmd Planning Docs

Research and product/development notes for **kmd**, the Kawaii MD reader: a compact, premium Markdown reader for **Windows and macOS first**, with iOS planned after the desktop reader is strong.

Researched: 2026-05-07

## What this folder contains

| File | Purpose |
|---|---|
| `../../README.md` | Project entrypoint |
| `../../AGENTS.md` | Required instructions for agents and automated contributors |
| `../../DESIGN.md` | Canonical kmd design-system source |
| `01-research-summary.md` | Short research conclusions and decisions |
| `02-product-vision.md` | Product identity, target users, positioning |
| `03-feature-spec.md` | Feature list, priorities, acceptance criteria |
| `04-markdown-dialect-spec.md` | Markdown syntax coverage: GitHub baseline + extended modes |
| `05-design-md-support.md` | First-class support plan for Google's `DESIGN.md` format |
| `06-rendering-architecture.md` | Parser, AST, sanitizer, renderer, theme pipeline |
| `07-cross-platform-technical-architecture.md` | Recommended stack for desktop-first delivery |
| `08-ui-ux-design-spec.md` | Reader UI, layout, typography, interactions |
| `09-security-privacy.md` | Local file safety, XSS, URL, WebView, Mermaid security |
| `10-performance-offline.md` | Performance targets, caching, large-file strategy |
| `11-implementation-roadmap.md` | Practical build plan by milestone |
| `12-test-plan-fixtures.md` | Test matrix and fixture list |
| `14-sample-doc-showcase.md` | Markdown feature showcase for testing the renderer |
| `16-references.md` | Curated source list |

## Executive decision

Build kmd as a **Tauri 2 app with a Rust backend and a web-rendered reader surface**.

Why:

- One renderer can serve Windows and macOS v1 while keeping iOS feasible later.
- The system WebView is enough for beautiful typography, tables, Mermaid, math, Shiki code highlighting, and token-driven styling.
- Rust can safely own file access, local indexing, watch mode, caching, and OS integration.
- The app remains much smaller than Electron-style apps.
- The rendering system can stay consistent across target platforms.

## Core implementation rule

Do **not** build a C++ core for v1.

Use Rust for native/backend responsibilities, TypeScript for the reader/rendering pipeline, and keep C/C++ parser exploration as a later compatibility or performance option.

## Core rendering rule

Do **not** invent a private Markdown dialect first.

Use this order:

1. **CommonMark/GitHub Flavored Markdown compatibility** as the baseline.
2. **GitHub-quality extras**: alerts, Mermaid, math, front matter, relative links, syntax highlighting.
3. **Reader-native enhancements**: document outline, typography presets, code copy, image zoom, table scroll.
4. **DESIGN.md mode**: parse design tokens, render style specimens, validate references/contrast, apply tokens as live document theme.

## Important clarification

Google's `DESIGN.md` is not a generic Markdown renderer. It is a **design-system document format**: optional YAML front matter for machine-readable tokens plus Markdown prose for human-readable and agent-readable design rationale. For kmd, it should be treated as a special Markdown document type with extra token visualization, validation, and theme application.
