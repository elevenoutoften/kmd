# kmd-web Implementation Plan

> Status: Binding
> Date: 2026-07-22
> Depends on: `17-kmd-ecosystem-north-star.md` (binding architecture)

## Purpose

Phase-by-phase plan for extracting shared code into `kmd-web`, reconciling the kmd/kmd-ios divergence, and eliminating the fork. Each phase has a clear exit gate.

---

## Phase 0 — Ownership and baseline (current)

| Task | Stable key | Status |
|------|-----------|--------|
| Record extraction inventory and public API ADR | KWEB-001 | In review |
| Provision public repository and npm identity | KWEB-002 | Todo |

**Exit gate:** North Star (doc 17) committed, ADR 001 committed, extraction inventory (doc 20) committed, baseline tests/build captured for both repos.

---

## Phase 1 — Create library with correct layer boundaries

**Goal:** Create the `kmd-web` repo with the layer structure from the North Star. Copy shared files into the correct layers, refactoring during copy — not after.

### 1.1 Core layer

Copy these files into `kmd-web/src/core/` with **no DOM, no Tauri, no browser globals**:

| Source (kmd) | Target | Refactor needed |
|-------------|--------|----------------|
| `src/parser/index.ts` | `core/renderMarkdown.ts` | Rename `parseMarkdown` → `renderMarkdown`, `ParseResult` → `RenderResult`, `ParseOptions` → `RenderOptions`. Remove `remarkWikilinks` from default pipeline (make it optional). |
| `src/parser/sanitize.ts` | `core/sanitize.ts` | No changes. |
| `src/parser/hast-utils.ts` | `core/hast-utils.ts` | No changes. |
| `src/parser/parse-cache.ts` | `core/parse-cache.ts` | No changes. |
| `src/parser/rehype-copy-button.ts` | `core/rehype-copy-button.ts` | No changes. |
| `src/parser/remark-wikilinks.ts` | `core/remark-wikilinks.ts` | No changes. Optional plugin, not in default pipeline. |
| `src/reader/linkPolicy.ts` | `core/linkPolicy.ts` | No changes. Pure TS. |

**What stays out of core:**
- `rehype-mermaid.ts` — the rehype plugin (tree transform) goes in core; `renderMermaidPlaceholders()` goes in browser runtime.
- `rehype-shiki.ts` — goes in core as a lazy-loaded optional plugin.
- `lazy-katex-css.ts` — goes in core as a lazy-loaded optional utility.
- `parse-worker-bridge.ts` — goes in worker subpath (bundler-specific).
- `parse-worker.ts` — goes in worker subpath.
- `design/` — goes in design subpath (optional, lazy).

### 1.2 Browser runtime layer

Copy these files into `kmd-web/src/browser/`:

| Source (kmd) | Target | Refactor needed |
|-------------|--------|----------------|
| `src/reader/domMorph.ts` | `browser/domMorph.ts` | No changes. Pure DOM. |
| `src/reader/anchorNavigation.ts` | `browser/anchorNavigation.ts` | No changes. Pure DOM. |
| `src/reader/codeBlockEnhancements.ts` | `browser/codeBlockEnhancements.ts` | Replace `navigator.clipboard` / `document.execCommand` with `ClipboardProvider` capability. Default implementation uses `navigator.clipboard` with fallback. |
| `src/parser/rehype-mermaid.ts` (render function only) | `browser/renderMermaidPlaceholders.ts` | Split: rehype plugin stays in core; `renderMermaidPlaceholders()` moves to browser. |

### 1.3 React layer

Copy these files into `kmd-web/src/react/`:

| Source (kmd) | Target | Refactor needed |
|-------------|--------|----------------|
| `src/reader/Reader.tsx` | `react/Reader.tsx` | Remove `isTauriRuntime()` imports. Replace Tauri dynamic imports with `LinkHandler` and `AssetResolver` from context. Replace `useToast()` with `NotificationSink` from context. Remove `resolveRelativeImages` import — use `AssetResolver` instead. |
| `src/reader/DocumentShell.tsx` | `react/DocumentShell.tsx` | Extract shared base; platform-specific shells stay in product repos or use props for layout variants. |
| `src/reader/resolveAssets.ts` | **Do not copy** | Replaced by `AssetResolver` capability in product shell. |
| `src/hooks/useToast.tsx` | `react/useToast.tsx` | No changes. Library exports the toast system. |
| `src/components/Toast.tsx` | `react/Toast.tsx` | No changes. |
| `src/components/ErrorBoundary.tsx` | `react/ErrorBoundary.tsx` | No changes. |
| `src/components/LoadingSkeleton.tsx` | `react/LoadingSkeleton.tsx` | No changes. |

### 1.4 Design layer (optional, lazy)

Copy `src/parser/design/` (20 files) into `kmd-web/src/design/` and `src/components/design/` (5 files) into `kmd-web/src/design/components/`.

### 1.5 Styles

Copy CSS files into `kmd-web/src/styles/`:
- `src/tokens.css` → `styles/tokens.css`
- `src/reader/Reader.css` → `styles/reader.css`
- `src/reader/DocumentShell.css` → `styles/document-shell.css`

### 1.6 Worker

Copy `src/parser/parse-worker-bridge.ts` and `src/parser/parse-worker.ts` into `kmd-web/src/worker/`.

### 1.7 Capability contracts

Define in `kmd-web/src/core/capabilities.ts`:
- `AssetResolver`
- `LinkHandler`
- `NotificationSink`
- `ClipboardProvider`

Define browser defaults in `kmd-web/src/browser/defaults.ts`:
- `defaultLinkHandler` — `window.open` for external, no-op for internal
- `defaultClipboardProvider` — `navigator.clipboard` with `execCommand` fallback

Define React context in `kmd-web/src/react/KmdProvider.tsx`:
- `KmdProvider` — accepts capability contracts, provides via context
- `useKmd()` — hook to access capabilities

**Exit gate:** Library builds with `tsc --emitDeclarationOnly` + Vite library mode. Library's own test suite passes (ported from kmd's tests).

---

## Phase 2 — Consume library in kmd (desktop)

1. Add `kmd-web` as a dependency in kmd's `package.json` (local link or npm).
2. Wire `KmdProvider` in `App.tsx` with Tauri-backed capability implementations:
   - `TauriAssetResolver` — wraps `invoke("resolve_asset")`
   - `TauriLinkHandler` — wraps `openUrl`, `invoke("resolve_local_path")`, `openPath`
   - `ToastNotificationSink` — wraps `useToast()`
   - `TauriClipboardProvider` — wraps Tauri clipboard or falls back to browser
3. Replace local imports:
   - `@/parser` → `kmd-web`
   - `@/reader/Reader` → `kmd-web/react`
   - `@/reader/DocumentShell` → `kmd-web/react`
   - `@/reader/domMorph` → `kmd-web/browser`
   - `@/reader/linkPolicy` → `kmd-web`
   - etc.
4. Run full test suite — all 730 tests must pass.
5. Run `npm run build` — must succeed.
6. Manual smoke test: open a file, render Markdown, click links, copy code, check Mermaid/Shiki/KaTeX.
7. **Only then** delete the local copies from kmd.

**Exit gate:** kmd builds and tests pass using `kmd-web` as a dependency. No local copies of shared files remain.

---

## Phase 3 — Consume library in kmd-ios

1. Add `kmd-web` as a dependency in kmd-ios's `package.json`.
2. Wire `KmdProvider` in kmd-ios's `App.tsx` with iOS-backed capability implementations.
3. Replace local imports (same as Phase 2).
4. Run full test suite — all 770 tests must pass.
5. Run `npm run build` — must succeed.
6. iOS-specific files (StoreKit, SupportPanel, viewportHeight, preview) remain in kmd-ios.
7. **Only then** delete the local copies from kmd-ios.

**Exit gate:** kmd-ios builds and tests pass using `kmd-web` as a dependency. Fork is eliminated — kmd-ios is a thin app shell around the shared library.

---

## Phase 4 — Web Component (deferred)

1. Create `kmd-web/web` subpath with a `<kmd-reader>` custom element.
2. Wraps `renderMarkdown()` + renders HTML into shadow DOM.
3. Exposes `content` attribute/property, `kmd:link-click` events.
4. Publish `kmd-web/web` subpath.

**Exit gate:** Web Component works in vanilla HTML without React. Separate ADR required.

---

## Phase 5 — kmd-unity alignment

1. kmd-unity stays C# (Markdig + UIToolkit) — no code sharing.
2. Share the `DesignDocument` IR type spec as a schema/JSON file.
3. Share design mode detection rules (document them, port to C#).
4. Feature parity tracked via a shared checklist.

**Exit gate:** Unity shares the IR spec document. No code coupling.

---

## Build and release

- Build tool: Vite library mode (not tsup — avoid unnecessary dependency).
- Output: ESM only for v0.1.
- TypeScript declarations: `tsc --emitDeclarationOnly`.
- CSS: copied as-is, not bundled.
- npm publish: after Phase 2 exit gate.

---

## References

- `docs/planning/17-kmd-ecosystem-north-star.md` — binding architecture
- `docs/planning/20-kmd-web-extraction-inventory.md` — file-by-file inventory
- `docs/adr/001-renderresult-shape-and-package-boundaries.md` — ADR for initial API shape