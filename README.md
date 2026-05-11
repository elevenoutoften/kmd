<p align="center">
  <img src="docs/assets/kmd-rounded-icon.png" alt="kmd app icon" width="160">
</p>

<h1 align="center">kmd</h1>

<p align="center">
  A compact, local-first Markdown reader for technical docs, product specs, and design-system documents.
</p>

<p align="center">
  <a href="https://github.com/elevenoutoften/kmd/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/elevenoutoften/kmd/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/elevenoutoften/kmd/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/elevenoutoften/kmd?include_prereleases"></a>
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
</p>

**kmd** is the Kawaii MD reader. The name is playful, but the app is calm, premium, and typography-led: it is built for reading Markdown without turning your document into an editor workspace.

## Features

- Opens local `.md`, `.markdown`, and `DESIGN.md` files.
- Renders CommonMark and GitHub Flavored Markdown.
- Supports GitHub alerts, tables, task lists, footnotes, math, Mermaid diagrams, and syntax-highlighted code.
- Treats `DESIGN.md` as a first-class design-system document with token extraction, previews, and HTML export.
- Keeps rendering local-first: no accounts, no telemetry by default, and no document upload.
- Uses Tauri 2 with a Rust backend and React/TypeScript renderer for a small desktop app footprint.

## Status

kmd is early alpha software. The core reader, parser pipeline, Design Mode, local file opening, recent files, and desktop release workflow are in place, but public releases may still change quickly.

Primary v1 targets:

- Windows
- macOS

iOS and other platforms remain architectural goals, but they are not release blockers for v1.

## Development

Prerequisites:

- [Node.js](https://nodejs.org/) 18 or newer
- Rust via [rustup](https://rustup.rs/)
- On Windows, [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the `Desktop development with C++` workload

Install dependencies:

```bash
npm install
```

Run the desktop app:

```bash
npm run tauri:dev
```

Run checks:

```bash
npm test
npm run build
cd src-tauri
cargo test
```

Build release artifacts:

```bash
npm run tauri:build
```

For local portable checks, `npm run tauri:portable` writes a standalone Windows binary to `src-tauri/target/release/kmd.exe`. GitHub releases publish signed and notarized macOS Apple Silicon downloads first, then macOS Intel, Windows portable, installer, and updater files alongside them.

## Project Docs

- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Release process](RELEASING.md)
- [Agent/contributor guidance](AGENTS.md)
- [Product and architecture planning docs](docs/planning/README.md)
- [kmd design system](DESIGN.md)

## Security Model

Markdown is local, but local does not mean trusted. kmd sanitizes rendered content, validates URL schemes, routes external links through the native OS handler, and resolves relative assets through the Rust backend under the opened document's folder.

See [SECURITY.md](SECURITY.md) for details.

## Non-Goals For V1

- Full WYSIWYG editing.
- Cloud sync or accounts.
- Arbitrary plugin execution.
- Exact GitHub server behavior beyond explicitly tested Markdown rendering features.
- C++ application core.
