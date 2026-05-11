# Contributing

Thanks for working on `kmd`.

## Before you start

1. Read `README.md` and `AGENTS.md`.
2. Find or open a GitHub issue unless the change is very small.
3. Read the planning docs relevant to the work.
4. Keep your changes scoped to the issue or pull request.

## Setup

Windows prerequisites:

- [Node.js](https://nodejs.org/) 18 or newer
- Rust: `winget install --id Rustlang.Rustup`
- [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the `Desktop development with C++` workload

Core app stack:

- Tauri 2
- Rust stable
- React + TypeScript + Vite
- npm for the current repo scripts

From the repo root:

```bash
npm install
npm run tauri:dev
```

This launches Vite, compiles the Rust backend, and opens the native desktop window.

Release build:

```bash
npm run tauri:build
```

On Windows, release bundle artifacts such as `.msi` and `.exe` packages are written under `src-tauri/target/release/bundle/`. MSI-specific output is written to `src-tauri/target/release/bundle/msi/`.

Tagged releases are automated through GitHub Actions. See `RELEASING.md` for the signing secret setup and the release/tag workflow.

Keep your changes scoped. Some tasks are docs-only; others are implementation work.

## Branch and commit guidance

- Use small branches named after the issue number or work area.
- Do not combine unrelated docs, frontend, backend, and security changes in one patch.
- Do not rewrite planning docs just for wording unless the task is documentation cleanup.

## Verification

Docs-only changes:

- Check for stale product names and uppercase shorthand.
- Inspect `git diff`.

Implementation changes:

- Run the relevant unit tests.
- Add fixtures for parser, sanitizer, URL/path policy, and `DESIGN.md` behavior.
- Visually check reader UI at desktop and narrow widths when UI changes.

## Pull request checklist

- GitHub issue is linked when one exists.
- Scope matches the issue or described request.
- Tests or docs were updated where needed.
- Security-sensitive behavior has fixture coverage.
- Product name is stylized as `kmd`.
