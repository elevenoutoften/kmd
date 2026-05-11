# AGENTS.md

This file is the working contract for agents and automated contributors working on `kmd`.

## Read order

Before changing files, read:

1. `README.md`
2. `AGENTS.md`
3. The GitHub issue, pull request, or user request that defines the work
4. `docs/planning/02-product-vision.md`
5. `docs/planning/06-rendering-architecture.md`
6. `docs/planning/07-cross-platform-technical-architecture.md`
7. `DESIGN.md` for UI or design-system work
8. `docs/planning/09-security-privacy.md` for rendering, links, images, WebView, Mermaid, math, or raw HTML work

## Naming rules

- The product name is `kmd`, always lowercase.
- Expanded description: Kawaii MD reader.
- Do not reintroduce uppercase shorthand or previous placeholder product names.
- `DESIGN.md`, `Markdown`, `MDX`, and file extensions may keep their normal casing.

## Architecture decisions

- v1 is desktop-first: Windows and macOS.
- iOS is planned later and should stay architecturally possible, but it is not a v1 gate.
- App stack: Tauri 2, Rust backend, React + TypeScript + Vite frontend.
- Rust owns native file access, path policy, URL policy, file watching, recent files, caching, and export plumbing.
- TypeScript owns the Markdown/rendering pipeline and reader UI.
- Do not build a C++ core for v1. C/C++ parser experiments are future compatibility/performance work only.

## Work tracking

- Work from one clear issue, pull request, or user request at a time.
- Keep tasks independent. Avoid editing files outside the requested scope unless required.
- If scope changes, explain the reason in the pull request or handoff notes.
- Prefer small, reviewable changes over broad rewrites.
- Do not mix unrelated docs, frontend, backend, and release changes in one patch unless the request is explicitly a repository-wide cleanup.

## Change scope

- For implementation tasks, keep changes tightly scoped to the issue or request.
- Never rewrite unrelated docs just for style.
- Do not scaffold new app surfaces unless the issue calls for them.

## Testing expectations

- Docs-only changes: run a search for stale product names and inspect `git diff`.
- App implementation changes: add or update focused tests for the changed behavior.
- Security-sensitive rendering changes must include malicious fixtures or unit tests.
- UI changes should be visually checked at desktop and narrow widths.

## Security posture

Read `docs/planning/09-security-privacy.md` before any rendering, link, image, WebView, Mermaid, math, or raw HTML work.

- Treat Markdown as untrusted even when it is local.
- Do not expose privileged Tauri commands to rendered document content.
- Block `javascript:`, `vbscript:`, unsafe `data:`, arbitrary `file:`, and unknown custom URL schemes.
- External links must open through the native OS handler, never inside the reader WebView.
- Remote images are blocked by default or loaded only after explicit user action.
- Raw HTML must be disabled or sanitized through a strict allowlist.
- SVG is risky: strip scripts and external references; prefer rendering as sanitized image.
- Mermaid and math rendering must not fetch external resources and must have render timeouts and error fallbacks.
- Resolve relative assets through the Rust backend only under the document's base folder; reject path-traversal attempts.
- Sanitize after parsing and AST transforms, not before.

## Style guidance

- kmd should feel premium, calm, technical, and typography-led.
- The name can be playful; the UI should not become toy-like.
- Prefer dense but readable reader controls over landing-page or marketing-page patterns.
