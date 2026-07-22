# KWEB-001: Extraction Inventory and Module Classification

> Evidence-backed map of every production file under `kmd/src/parser`, `kmd/src/reader`, shared design components/styles, and the corresponding `kmd-ios` areas. Produced as the baseline for extracting a reusable `kmd-web` library.
>
> Revised v2 (2026-07-22): corrected build result, diverged counts, dependency labeling, security-surface inventory, and module classifications to align with the North Star (`docs/planning/17-kmd-ecosystem-north-star.md`).

## Method

1. Enumerated all non-test `.ts`/`.tsx`/`.css` files under `src/parser/`, `src/reader/`, `src/components/`, `src/hooks/`, `src/utils/`, and top-level `src/` in both repos.
2. Ran `diff` on every file pair to classify as **identical**, **diverged**, or **platform-only**.
3. Searched for Tauri imports (`@tauri-apps/*`, `isTauriRuntime`, `invoke`), browser globals (`document.`, `window.`, `navigator.`, `localStorage`, `Worker`, `postMessage`), bundler-specific patterns (`new URL(..., import.meta.url)`), CSS imports, and heavy dynamic imports (Mermaid, KaTeX, Shiki).
4. Ran baseline tests, TypeScript compilation, and production build on both repos.

---

## 1. Parser module inventory (`src/parser/`)

### 1.1 File-by-file comparison

| File | kmd | kmd-ios | Status | Notes |
|------|-----|---------|--------|-------|
| `index.ts` | ✓ | ✓ | **Diverged** | kmd adds `remarkWikilinks` plugin and table-wrapper div. 6 changed lines. |
| `sanitize.ts` | ✓ | ✓ | Identical | URL policy + sanitize schema. Zero deps on Tauri/DOM. |
| `hast-utils.ts` | ✓ | ✓ | Identical | Pure HAST utilities. |
| `parse-cache.ts` | ✓ | ✓ | Identical | LRU parse cache. Pure TS. |
| `parse-worker.ts` | ✓ | ✓ | Identical | Web Worker entry. Uses `self.postMessage`. |
| `parse-worker-bridge.ts` | ✓ | ✓ | Identical | Worker manager. Uses `new URL("./parse-worker.ts", import.meta.url)` — bundler-specific. |
| `rehype-shiki.ts` | ✓ | ✓ | Identical | Syntax highlighting. Lazy-loads `shiki/core` + `@shikijs/langs/*` + `@shikijs/themes/*`. |
| `rehype-mermaid.ts` | ✓ | ✓ | Identical | Mermaid placeholder injection + `renderMermaidPlaceholders()`. Rehype plugin (tree transform) is pure. `renderMermaidPlaceholders()` uses DOM (`querySelector`, `innerHTML`) — must split to browser layer. Lazy-loads `mermaid`. |
| `rehype-copy-button.ts` | ✓ | ✓ | **Diverged** | Whitespace-only diff (trailing spaces). 8 changed lines, zero functional difference. |
| `lazy-katex-css.ts` | ✓ | ✓ | Identical | Lazy-imports `katex/dist/katex.min.css`. |
| `remark-wikilinks.ts` | ✓ | ✗ | **kmd-only** | Custom remark plugin for `[[wikilink]]` syntax. Not yet in kmd-ios. |
| `design/` (20 files) | ✓ | ✓ | Identical | All 20 design pipeline files identical. Pure TS. |
| `ios-security.test.ts` | ✗ | ✓ | **kmd-ios-only** | iOS WebView security audit tests (22 tests). Test-only, not production. |

### 1.2 Parser classification

Per the North Star layer model: **core is DOM-free**, browser-coupled code goes in the browser runtime layer.

| Module | Classification | Rationale |
|--------|---------------|-----------|
| `index.ts` | **Core** | Unified pipeline entry. Exports `parseMarkdown()`, `ParseResult`, `OutlineEntry`, `ParseOptions`. Pure TS, zero platform deps. |
| `sanitize.ts` | **Core** | URL policy + sanitize schema. Pure TS. |
| `hast-utils.ts` | **Core** | HAST text extraction. Pure TS. |
| `parse-cache.ts` | **Core** | LRU cache. Pure TS. |
| `parse-worker.ts` | **Optional worker** | Web Worker message handler. Uses `self` (worker scope). |
| `parse-worker-bridge.ts` | **Optional worker** | Worker manager. Uses `new URL(..., import.meta.url)` — bundler-specific. |
| `rehype-shiki.ts` | **Core (optional, lazy)** | Syntax highlighting rehype plugin. Lazy-loads Shiki. No DOM deps. |
| `rehype-mermaid.ts` (rehype plugin) | **Core (optional, lazy)** | Tree transform that replaces mermaid code blocks with placeholder divs. Pure HAST. |
| `rehype-mermaid.ts` (`renderMermaidPlaceholders`) | **Browser runtime** | Post-parse DOM rendering. Uses `querySelector`, `innerHTML`. Must split from the rehype plugin. |
| `rehype-copy-button.ts` | **Core** | Adds copy buttons to code blocks. Pure HAST transform. |
| `lazy-katex-css.ts` | **Core (optional, lazy)** | Lazy CSS import for KaTeX. |
| `remark-wikilinks.ts` | **Core** | Wikilink syntax plugin. Pure remark plugin. |
| `design/` (all 20 files) | **Optional design (lazy)** | Design Mode pipeline (detect → extract → merge → resolve → enrich → IR). Pure TS. Lazy-loaded optional feature. |

### 1.3 Parser coupling evidence

**No Tauri imports** in any parser file. The parser is 100% platform-independent.

**Bundler-specific**: `parse-worker-bridge.ts:16` uses `new URL("./parse-worker.ts", import.meta.url)` to spawn a Web Worker. This is a Vite/webpack-specific pattern. For `kmd-web`, the worker must be optional with a sync fallback (already exists in `parseMarkdownInWorker` — falls back to `parseMarkdown` on worker error).

**DOM coupling**: `rehype-mermaid.ts:57-94` — `renderMermaidPlaceholders()` uses `container.querySelectorAll`, `target.innerHTML`, `placeholder.dataset`. This function runs post-parse, in the browser, and requires a DOM container. It is not part of the pure parsing pipeline. The rehype plugin itself (tree transform) is pure; only the render step needs DOM. **This function must be split into the browser runtime layer.**

**Post-sanitization DOM insertion risk**: `renderMermaidPlaceholders()` injects `target.innerHTML = result.svg` (line 92) **after** the HTML sanitizer (`rehype-sanitize`) has already run. The Mermaid SVG output is not re-sanitized. See §7.3 for the security boundary documentation.

**Heavy dynamic imports**: Shiki (30+ language imports), Mermaid, KaTeX CSS — all lazy-loaded via `import()`. These are optional and should remain lazy in the library.

---

## 2. Reader module inventory (`src/reader/`)

### 2.1 File-by-file comparison

| File | kmd | kmd-ios | Status | Divergence detail |
|------|-----|---------|--------|-------------------|
| `Reader.tsx` | ✓ | ✓ | **Diverged** (10 lines) | kmd imports `parseInternalHref` from `linkPolicy`; kmd-ios inlines `href.split("#", 2)`. kmd has `remarkWikilinks` table wrapper. |
| `DocumentShell.tsx` | ✓ | ✓ | **Diverged** (404 lines) | Major divergence — kmd-ios has mobile-specific layout (viewport height, touch, iOS chrome). |
| `DocumentShell.css` | ✓ | ✓ | **Diverged** (275 lines) | Corresponding CSS divergence for mobile layout. |
| `Reader.css` | ✓ | ✓ | **Diverged** (154 lines) | iOS-specific style adjustments. |
| `linkPolicy.ts` | ✓ | ✓ | **Diverged** (24 lines) | kmd adds `parseInternalHref()` and `InternalHrefParts` interface; kmd-ios lacks these. |
| `domMorph.ts` | ✓ | ✓ | Identical | Block-level DOM diffing. Pure DOM. |
| `anchorNavigation.ts` | ✓ | ✓ | Identical | Anchor target finding. Pure DOM. |
| `codeBlockEnhancements.ts` | ✓ | ✓ | **Diverged** (4 lines) | Whitespace-only diff (trailing spaces). Zero functional difference. |
| `resolveAssets.ts` | ✓ | ✓ | Identical | Tauri IPC for relative image resolution. |

### 2.2 Reader classification

Per the North Star layer model:

| Module | Classification | Rationale |
|--------|---------------|-----------|
| `Reader.tsx` | **React** | Main reader component. React hooks + DOM. Tauri coupling via `isTauriRuntime()` guards + dynamic `@tauri-apps/*` imports. Toast coupling via `useToast()`. Must refactor to use capability contracts. |
| `DocumentShell.tsx` | **React** | Outline sidebar + scroll container. Zero Tauri deps. Major mobile divergence. |
| `domMorph.ts` | **Browser runtime** | DOM diffing. Pure DOM API. No React, no Tauri. |
| `anchorNavigation.ts` | **Browser runtime** | Anchor scrolling. Pure DOM. |
| `linkPolicy.ts` | **Core** | URL classification. Pure TS. No DOM, no Tauri. |
| `codeBlockEnhancements.ts` | **Browser runtime** | Code block enhancements. Uses `navigator.clipboard`, `document.createElement`, `document.execCommand`. Pure DOM. Clipboard must be injected via `ClipboardProvider` capability. |
| `resolveAssets.ts` | **Product shell (adapter)** | Tauri IPC for image resolution. `isTauriRuntime()` + `invoke("resolve_asset")`. Platform-specific. Replaced by `AssetResolver` capability. |
| `Reader.css` | **Styles** | Content styles. Diverged for iOS. |
| `DocumentShell.css` | **Styles** | Chrome styles. Diverged for iOS. |

### 2.3 Reader coupling evidence

**Tauri coupling** (all in `Reader.tsx`):
- Line 18: `import { isTauriRuntime } from "@/utils/platform"`
- Line 30: `const tauriRuntime = isTauriRuntime()`
- Line 34: `const { openUrl } = await import("@tauri-apps/plugin-opener")` — external link opening
- Line 63: `const { invoke } = await import("@tauri-apps/api/core")` — internal link resolution
- Line 70: `const { openPath } = await import("@tauri-apps/plugin-opener")` — open directory
- Line 83: `const { openPath } = await import("@tauri-apps/plugin-opener")` — open non-markdown file

All Tauri calls are **dynamic imports guarded by `isTauriRuntime()`**. The non-Tauri fallback uses `window.open()` (line 44). In the library, these are replaced by `LinkHandler` capability contracts. `isTauriRuntime()` stays in the product shell, not in the library.

**Toast/notification coupling** (in `Reader.tsx`):
- Line 19: `import { useToast } from "@/hooks/useToast"`
- Line 108: `const { toast } = useToast()`
- Line 268: `toastRef.current(message, { type: "success" })` — called after copying link path to clipboard

The toast coupling is through a React context (`ToastProvider`). For the library, this is replaced with an optional `NotificationSink` capability.

**DOM coupling** (browser runtime):
- `Reader.tsx:152`: `parseMarkdownInWorker(content)` — worker bridge
- `Reader.tsx:246`: `window.requestAnimationFrame(updateActiveHeading)`
- `Reader.tsx:250-251`: `scrollContainer.addEventListener("scroll", ...)`, `window.addEventListener("resize", ...)`
- `Reader.tsx:337`: `el.addEventListener("click", handleLinkClick, true)`
- `Reader.tsx:361-364`: `dangerouslySetInnerHTML` memoization for React 19 compatibility

**React coupling**: `Reader.tsx` uses `useState`, `useEffect`, `useLayoutEffect`, `useMemo`, `useRef`, `useCallback`. `DocumentShell.tsx` uses `useCallback`, `useRef`, `useState`, `ReactNode`.

**resolveAssets.ts** (full Tauri coupling):
- Line 1: `import { isTauriRuntime } from "@/utils/platform"`
- Line 13: `if (!isTauriRuntime() || !docPath) return`
- Line 18: `const { invoke } = await import("@tauri-apps/api/core")`
- Line 22: `invoke<AssetData>("resolve_asset", { docPath, relativePath: src })`

This is entirely platform-specific and is replaced by the `AssetResolver` capability contract in the product shell.

---

## 3. Design components inventory (`src/components/design/`)

### 3.1 File-by-file comparison

| File | kmd | kmd-ios | Status |
|------|-----|---------|--------|
| `DesignCatalog.tsx` | ✓ | ✓ | Identical |
| `DesignCatalog.css` | ✓ | ✓ | **Diverged** (10 lines, minor) |
| `DesignMode.tsx` | ✓ | ✓ | Identical |
| `exportHtml.ts` | ✓ | ✓ | Identical |
| `showcaseTheme.ts` | ✓ | ✓ | Identical |

### 3.2 Design component classification

| Module | Classification | Rationale |
|--------|---------------|-----------|
| `DesignCatalog.tsx` | **Optional design (React)** | Design Mode preview. Uses React, `document.getElementById`, `document.createElement`, `document.head.appendChild`. |
| `DesignMode.tsx` | **Optional design (React)** | Design Mode tab wrapper. Uses `useMemo`. |
| `exportHtml.ts` | **Optional design** | HTML export. Uses `createElement` from React, reads `sheet.cssRules`. |
| `showcaseTheme.ts` | **Optional design** | Showcase theme data. Pure TS. |
| `DesignCatalog.css` | **Optional design (styles)** | Design catalog styles. |

---

## 4. Shared infrastructure inventory

### 4.1 Top-level src files

| File | kmd | kmd-ios | Status | Classification |
|------|-----|---------|--------|----------------|
| `tokens.css` | ✓ | ✓ | Identical | **Styles** — CSS custom properties. Pure CSS. |
| `theme.ts` | ✓ | ✓ | **Diverged** (51 lines) | **Product shell** — localStorage theme. Diverged for iOS. |
| `App.tsx` | ✓ | ✓ | **Diverged** (278 lines) | **Product shell** — app entry. Heavy Tauri coupling. |
| `App.css` | ✓ | ✓ | **Diverged** (88 lines) | **Product shell** — app styles. |
| `global.css` | ✓ | ✓ | **Diverged** (28 lines) | **Product shell** — global styles. |
| `main.tsx` | ✓ | ✓ | **Diverged** (13 lines) | **Product shell** — React root. |
| `updater.ts` | ✓ | ✓ | Identical | **Product shell** — Tauri updater. |
| `tauri-types.d.ts` | ✓ | ✓ | Identical | **Product shell** — Tauri type helpers. |
| `vite-env.d.ts` | ✓ | ✓ | Identical | **Product shell** — Vite env types. |

### 4.2 Hooks

| File | kmd | kmd-ios | Status | Classification |
|------|-----|---------|--------|----------------|
| `useKeyboardShortcuts.ts` | ✓ | ✓ | Identical | **Product shell** — keyboard shortcuts. |
| `useRecentFiles.ts` | ✓ | ✓ | Identical | **Product shell** — recent files (Tauri IPC). |
| `useToast.tsx` | ✓ | ✓ | Identical | **React** — toast notification context. |
| `useDocumentState.ts` | ✓ | ✓ | **Diverged** (124 lines) | **Product shell** — document state (Tauri IPC). |
| `useSupporterStatus.ts` | ✗ | ✓ | **iOS-only** | **iOS adapter** — StoreKit supporter status. |
| `useSupportPrompt.ts` | ✗ | ✓ | **iOS-only** | **iOS adapter** — support prompt. |

### 4.3 Utils

| File | kmd | kmd-ios | Status | Classification |
|------|-----|---------|--------|----------------|
| `platform.ts` | ✓ | ✓ | Identical | **Product shell** — `isTauriRuntime()` check. Not in core (per North Star: no runtime detection in library core). |
| `viewportHeight.ts` | ✗ | ✓ | **iOS-only** | **iOS adapter** — viewport height management. |

### 4.4 Components (non-design)

| File | kmd | kmd-ios | Status | Classification |
|------|-----|---------|--------|----------------|
| `ErrorBoundary.tsx` | ✓ | ✓ | Identical | **React** — error boundary. |
| `LoadingSkeleton.tsx` | ✓ | ✓ | Identical | **React** — loading skeleton. |
| `Toast.tsx` | ✓ | ✓ | Identical | **React** — toast component. |
| `WelcomeScreen.tsx` | ✓ | ✓ | **Diverged** (88 lines) | **Product shell** — welcome screen. |
| `SupportPanel.tsx` | ✗ | ✓ | **iOS-only** | **iOS adapter** — support panel. |

---

## 5. Platform-only files summary

### 5.1 kmd-only

| File | Reason |
|------|--------|
| `src/parser/remark-wikilinks.ts` | New wikilink syntax plugin, not yet merged to kmd-ios. |

### 5.2 kmd-ios-only

| File | Reason |
|------|--------|
| `src/parser/ios-security.test.ts` | iOS WebView security audit tests (22 tests). Test-only. |
| `src/components/SupportPanel.tsx` | iOS StoreKit support panel. |
| `src/components/SupportPanel.css` | iOS StoreKit support panel styles. |
| `src/hooks/useSupporterStatus.ts` | iOS StoreKit supporter status. |
| `src/hooks/useSupportPrompt.ts` | iOS support prompt logic. |
| `src/hooks/useSupportPrompt.test.ts` | iOS support prompt tests. |
| `src/utils/viewportHeight.ts` | iOS viewport height management. |
| `src/utils/viewportHeight.test.ts` | iOS viewport height tests. |
| `src/preview/main.tsx` | iOS preview app entry. |
| `src/preview/PreviewApp.tsx` | iOS preview app component. |
| `src/preview/preview.css` | iOS preview app styles. |

---

## 6. Coupling summary table

### 6.1 Identical shared files (portable as-is)

| Area | Files | Count |
|------|-------|-------|
| Parser core | `index.ts`*, `sanitize.ts`, `hast-utils.ts`, `parse-cache.ts`, `rehype-copy-button.ts`* | 5 |
| Parser optional (lazy) | `rehype-shiki.ts`, `rehype-mermaid.ts`, `lazy-katex-css.ts` | 3 |
| Parser worker | `parse-worker.ts`, `parse-worker-bridge.ts` | 2 |
| Parser design (optional) | All 20 `design/` files | 20 |
| Reader core (pure TS) | `linkPolicy.ts`* | 1 |
| Reader browser runtime | `domMorph.ts`, `anchorNavigation.ts`, `codeBlockEnhancements.ts`* | 3 |
| Reader product shell | `resolveAssets.ts` | 1 |
| Reader React | `DocumentShell.tsx`*, `Reader.tsx`* | 2 |
| Styles | `tokens.css`, `Reader.css`*, `DocumentShell.css`* | 3 |
| Design components | `DesignCatalog.tsx`, `DesignMode.tsx`, `exportHtml.ts`, `showcaseTheme.ts`, `DesignCatalog.css`* | 5 |
| Shared infra | `updater.ts`, `tauri-types.d.ts`, `useToast.tsx`, `useKeyboardShortcuts.ts`, `useRecentFiles.ts`, `ErrorBoundary.tsx`, `LoadingSkeleton.tsx`, `Toast.tsx`, `platform.ts` | 9 |

\* = diverged but functionally near-identical (whitespace or minor feature differences)

### 6.2 Diverged files needing reconciliation

**Total diverged: 16 files** (13 functional, 3 whitespace-only)

| File | Divergence | Reconciliation |
|------|-----------|----------------|
| `parser/index.ts` | kmd adds `remarkWikilinks` + table wrapper | Make wikilinks optional plugin in library |
| `parser/rehype-copy-button.ts` | Whitespace only (trailing spaces) | Pick one, no functional change |
| `reader/Reader.tsx` | kmd uses `parseInternalHref()`, kmd-ios inlines | Use kmd version (cleaner API) |
| `reader/linkPolicy.ts` | kmd adds `parseInternalHref()` | Use kmd version |
| `reader/codeBlockEnhancements.ts` | Whitespace only (trailing spaces) | Pick one |
| `reader/DocumentShell.tsx` | Major mobile divergence | Split: shared base + platform-specific shells |
| `reader/DocumentShell.css` | Major mobile divergence | Split: shared base + platform-specific CSS |
| `reader/Reader.css` | iOS-specific adjustments | Split: shared base + platform overrides |
| `theme.ts` | iOS storage divergence | Product shell — not library |
| `App.tsx` | Major platform divergence | Product shell — not library |
| `App.css` | Platform-specific | Product shell — not library |
| `global.css` | Platform-specific | Product shell — not library |
| `main.tsx` | Platform-specific | Product shell — not library |
| `WelcomeScreen.tsx` | Platform-specific | Product shell — not library |
| `hooks/useDocumentState.ts` | Tauri IPC divergence | Product shell — not library |
| `components/design/DesignCatalog.css` | Minor | Merge or split |

### 6.3 Target package ownership

Per the North Star layer model (`docs/planning/17-kmd-ecosystem-north-star.md`):

| Responsibility | Target | Rationale |
|---------------|--------|-----------|
| Markdown parsing pipeline | `kmd-web` (core) | Pure TS, zero platform deps |
| Sanitize schema + URL policy | `kmd-web` (core) | Pure TS |
| Link policy (classify, normalize, parse) | `kmd-web` (core) | Pure TS |
| HAST utilities | `kmd-web` (core) | Pure TS |
| Parse cache | `kmd-web` (core) | Pure TS |
| Copy button HAST transform | `kmd-web` (core) | Pure HAST |
| Wikilinks plugin | `kmd-web` (core, optional) | Pure remark plugin |
| Shiki highlighting (rehype plugin) | `kmd-web` (core, lazy) | Lazy-loaded, no DOM deps at import time |
| Mermaid rehype plugin (tree transform) | `kmd-web` (core, lazy) | Pure HAST transform |
| Mermaid render (`renderMermaidPlaceholders`) | `kmd-web/browser` | Requires DOM (querySelector, innerHTML) |
| KaTeX CSS lazy import | `kmd-web` (core, lazy) | Lazy import |
| DOM morphing | `kmd-web/browser` | Pure DOM |
| Anchor navigation | `kmd-web/browser` | Pure DOM |
| Code block enhancements | `kmd-web/browser` | Pure DOM, clipboard via capability |
| Worker bridge | `kmd-web/worker` (optional) | Bundler-specific, optional |
| Reader component | `kmd-web/react` | React, capabilities via context |
| DocumentShell component | `kmd-web/react` | React, platform-specific variants |
| Toast system | `kmd-web/react` | React context |
| ErrorBoundary, LoadingSkeleton | `kmd-web/react` | React |
| CSS tokens | `kmd-web/styles` | Raw CSS |
| Reader/DocumentShell styles | `kmd-web/styles` | Raw CSS (shared base) |
| Design Mode components | `kmd-web/design` (optional) | React + DOM |
| Showcase theme data | `kmd-web/design` (optional) | Pure TS |
| Export HTML | `kmd-web/design` (optional) | React + DOM |
| Image resolution | **Product shell** (AssetResolver) | Tauri IPC — platform-specific |
| File open/save, recent files | **Product shell** | Tauri IPC — platform-specific |
| Theme storage | **Product shell** | localStorage / iOS storage |
| App shell (App.tsx, main.tsx) | **Product shell** | Platform-specific |
| Updater | **Product shell** | Tauri updater |
| `isTauriRuntime()` | **Product shell** | Runtime detection — not in library |
| StoreKit / SupportPanel | **kmd-ios only** | iOS-only |
| Viewport height | **kmd-ios only** | iOS-only |

---

## 7. Security-critical behavior enumeration

### 7.1 Security surfaces

| Surface | Location | Behavior |
|---------|----------|----------|
| URL scheme allowlist | `sanitize.ts:isSafeUrl()` | Allows http, https, mailto, tel + relative/fragment. Blocks javascript:, vbscript:, data:, file:, custom schemes. |
| Event handler stripping | `sanitize.ts:rehypeUrlPolicy` | Strips all `on*` attributes from all elements. |
| External link rel | `sanitize.ts:rehypeUrlPolicy` | Adds `rel="noopener noreferrer"` to external links. |
| Sanitize schema | `sanitize.ts:sanitizeSchema` | Extends rehype-sanitize defaults with safe inline HTML tags, KaTeX MathML, Shiki spans, Mermaid SVG. |
| Link classification | `linkPolicy.ts:classifyRenderedLink()` | Classifies links as fragment/internal/external/blocked. |
| Internal link resolution | `Reader.tsx:handleInternalLink()` | Resolves via Tauri `resolve_local_path` command. Guards with `isTauriRuntime()`. Replaced by `LinkHandler` capability. |
| External link opening | `Reader.tsx:openExternalLink()` | Opens via Tauri `openUrl` or `window.open`. Never opens in reader WebView. Replaced by `LinkHandler` capability. |
| Image resolution | `resolveAssets.ts:resolveRelativeImages()` | Resolves via Tauri `resolve_asset` command. Skips http/https/data/blob/#/absolute paths. Replaced by `AssetResolver` capability. |
| Raw HTML policy | `sanitize.ts:sanitizeSchema` | Allows: br, kbd, sub, sup, mark, abbr, details, summary, div. Blocks: script, iframe, object, embed, link, meta, style, form, input, button. |
| Mermaid sandbox | `rehype-mermaid.ts` | No external network, config locked down, render timeout, error fallback. |
| KaTeX policy | `lazy-katex-css.ts` | No network, unsafe macros disabled (via rehype-katex defaults). |

### 7.2 Baseline malicious fixtures

| Fixture | Location | Test count | Tests |
|---------|----------|------------|-------|
| `xss-test.md` | `fixtures/xss-test.md` | — | javascript: links, vbscript:, data: URIs, file:, HTML event handlers, SVG scripts, nested encoding, object/embed tags |
| `safe-test.md` | `fixtures/safe-test.md` | — | Safe links, images, code, tables, task lists, blockquotes, normal HTML |
| `sanitize.test.ts` | `src/parser/sanitize.test.ts` | 28 tests | `isSafeUrl` unit tests (safe + unsafe URLs), pipeline XSS mitigation (javascript:, mixed case, vbscript:, data: URIs, file:, custom schemes, event handlers, raw HTML buttons, rel=noopener, safe link preservation, clobber-safe IDs) |
| `ios-security.test.ts` | `src/parser/ios-security.test.ts` (kmd-ios only) | 22 tests | CSP properties, XSS attack vectors (javascript:, mixed case, vbscript:, data:, SVG onload, file:, custom schemes), bridge isolation (script, iframe, object/embed, srcdoc), remote image policy, controlled handler verification |

### 7.3 Mermaid post-sanitization DOM insertion — security boundary

`renderMermaidPlaceholders()` (`rehype-mermaid.ts:57-94`) injects Mermaid's SVG output via `target.innerHTML = result.svg` (line 92) **after** the HTML sanitizer (`rehype-sanitize`) has already run on the parsed HTML. This means:

1. The Mermaid SVG is not re-sanitized by `rehype-sanitize`.
2. Mermaid's output could theoretically contain unsafe SVG elements (scripts, external references).
3. The sanitize schema allows SVG elements (`svg`, `path`, `g`, `text`, etc.) because Mermaid needs them, but this also means a compromised Mermaid library could inject arbitrary SVG.

**Required downstream actions:**
- Document this as a known security boundary in the `kmd-web` library README.
- Consumers must ensure their CSP blocks inline scripts and external resources (`script-src 'self'`, `img-src 'self' data: blob:`).
- `renderMermaidPlaceholders()` must be in the browser runtime layer (not core) so it is clear this is a DOM-level security surface.
- Future work: re-sanitize Mermaid SVG output before injecting, or use a dedicated SVG sanitizer.
- Add a test that renders a Mermaid diagram and verifies no `<script>` tags survive in the output.

### 7.4 Security boundaries preventing direct move

1. **Tauri IPC for image resolution** (`resolveAssets.ts`): The `resolve_asset` command reads files through the Rust backend, preventing path traversal. In the library, this is replaced by the `AssetResolver` capability.
2. **Tauri IPC for internal link resolution** (`Reader.tsx:handleInternalLink`): The `resolve_local_path` command resolves relative paths safely. In the library, this is replaced by the `LinkHandler` capability.
3. **Tauri `openUrl` for external links** (`Reader.tsx:openExternalLink`): Prevents links from opening inside the reader WebView. Non-Tauri fallback uses `window.open`. Replaced by `LinkHandler` capability.
4. **CSP enforcement** (platform-level, not code): The CSP is set by Tauri/Rust config, not by the TypeScript code. The library cannot enforce CSP — consumers must set their own.
5. **Mermaid post-sanitization insertion** (see §7.3): `renderMermaidPlaceholders()` injects SVG after sanitization. This is a known security boundary requiring downstream testing and CSP enforcement.

---

## 8. Baseline commands and results

### 8.1 kmd (desktop)

| Command | Result |
|---------|--------|
| `npm test` | **35 test files, 730 tests, all passed.** Duration: 46.45s. |
| `npx tsc -b --noEmit` | **Clean (exit 0).** No TypeScript errors. |
| `npm run build` | **Succeeded** (`tsc -b && vite build`). Builds frontend bundle with Vite. Does not require Rust/Tauri compilation or a live Tauri context. Emits bundle-size warnings for large chunks (shiki, mermaid, katex). |

### 8.2 kmd-ios

| Command | Result |
|---------|--------|
| `npm test` | **38 test files, 770 tests, all passed.** Duration: 47.97s. |
| `npx tsc -b --noEmit` | **Clean (exit 0).** No TypeScript errors. |

### 8.3 Test count delta

kmd-ios has 3 additional test files (40 more tests) compared to kmd:
- `src/parser/ios-security.test.ts` — 22 tests (iOS WebView security audit)
- `src/utils/viewportHeight.test.ts` — 2 tests (iOS viewport height)
- `src/hooks/useSupportPrompt.test.ts` — 16 tests (iOS support prompt)

### 8.4 Test counts for security-related files

| Test file | Repo | Test count |
|-----------|------|------------|
| `src/parser/sanitize.test.ts` | kmd (shared) | 28 tests |
| `src/parser/ios-security.test.ts` | kmd-ios only | 22 tests |

### 8.5 Fixture count

| Repo | Fixtures | Count |
|------|----------|-------|
| kmd | `fixtures/` directory | 20 files (including design-mode subdirectory) |
| kmd-ios | Same `fixtures/` directory | 20 files (identical to kmd) |

### 8.6 Dependency graph

**Shared dependencies** (present in both repos, identical versions):
- `unified`, `remark-parse`, `remark-gfm`, `remark-math`, `remark-github-alerts`, `remark-rehype`
- `rehype-katex`, `rehype-raw`, `rehype-sanitize`, `rehype-slug`, `rehype-stringify`
- `shiki`, `katex`, `mermaid`
- `react`, `react-dom`
- `js-yaml`, `unist-util-visit`

**Tauri dependencies** (present in both repos):
- `@tauri-apps/api` — both repos
- `@tauri-apps/plugin-dialog` — both repos
- `@tauri-apps/plugin-opener` — both repos
- `@tauri-apps/plugin-process` — both repos
- `@tauri-apps/plugin-updater` — both repos
- `@tauri-apps/plugin-fs` — **kmd-ios only** (for iOS file system access)

**Dev dependencies** (identical in both repos): `@tauri-apps/cli`, `@types/*`, `@vitejs/plugin-react`, `jsdom`, `typescript`, `vite`, `vitest`

---

## 9. No unexplained files

Every production file under `src/parser/`, `src/reader/`, `src/components/`, `src/hooks/`, `src/utils/`, and top-level `src/` in both repos has been accounted for in the inventory above. Test files and fixtures are excluded from the extraction scope but enumerated for baseline purposes.