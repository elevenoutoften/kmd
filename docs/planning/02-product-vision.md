# Product Vision

## Name

**kmd**

Expanded description: **Kawaii MD reader**.

The product name is always stylized lowercase as `kmd`. The brand should feel premium and calm; "Kawaii" is a compact, memorable name origin, not a directive to make the UI toy-like.

## Product promise

A compact, calm, beautiful Markdown reader that makes technical and design documents feel like premium native reading material.

## Target platforms

- Windows
- macOS
- Later: iOS, iPadOS, Linux, Android

Desktop comes first. iOS remains an architectural target, but it should not slow down the first excellent Windows/macOS reader.

## Target users

1. Developers reading READMEs, specs, changelogs, project docs.
2. Designers and product people reading `DESIGN.md`, design specs, product docs.
3. AI-agent power users using Markdown project kits.
4. Writers who want a clean local Markdown reader without a heavy editor.
5. Teams who exchange specs as plain `.md` files.

## Positioning

Not a full IDE. Not a notes database. Not a bloated Markdown editor.

kmd is a **reader-first Markdown app** with optional light editing later.

## Design principles

### 1. Reader-first

The default surface should feel like a beautifully typeset article, not a GitHub page clone.

### 2. GitHub-compatible where expected

Users expect README files to render correctly. GitHub-flavored features are the practical baseline.

### 3. Design-system-aware

`DESIGN.md` is rendered as a living design artifact, not just text.

### 4. Local-first and private

Local files remain local. No account required. No sync backend required.

### 5. Compact

Fast launch, low memory, simple UI, no workspace ceremony.

### 6. Beautiful by default

Good margins, typography, code blocks, callouts, tables, and images should require zero configuration.

## Product modes

### Reader Mode

The normal mode. Opens and renders a document.

### Source Mode

Shows plain Markdown source, optionally side-by-side with preview.

### Design Mode

Activated for `DESIGN.md` and token-heavy Markdown files. Shows token galleries, type specimens, component swatches, and validation.

### Presentation Mode

Optional later: full-screen reading with larger typography and keyboard navigation.

## Non-goals for v1

- Full collaborative editing.
- Cloud account system.
- WYSIWYG editor.
- Git client replacement.
- Obsidian-style backlink database.
- Arbitrary plugin execution.
- C++ application core.
- Exact GitHub server-side behavior for mentions, issues, PR links, or repository-specific autolinks unless repo context is configured.

## Product personality

- Quiet
- Premium
- Tactile
- Sharp typography
- Warm but technical
- Apple-like polish without becoming sterile
