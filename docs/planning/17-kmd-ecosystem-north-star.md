# kmd Ecosystem North Star

> Status: Binding
> Date: 2026-07-22
> Supersedes: `19-kmd-web-library-research.md` (research, now superseded by this architecture decision)

## Purpose

This document fixes the architectural boundaries for extracting kmd's shared Markdown rendering engine into a reusable npm library (`kmd-web`). It is the binding reference for all downstream implementation plans, ADRs, and extraction tasks.

No extraction task may proceed until it is reconciled with this document.

---

## 1. Layer model

The shared code is organized into layers with strict dependency rules. Each layer may only import from layers below it, never above.

```
┌─────────────────────────────────────────────────────┐
│ Product shell (kmd, kmd-ios)                        │
│ App.tsx, main.tsx, theme.ts, updater.ts,            │
│ useDocumentState, useRecentFiles, WelcomeScreen      │
├─────────────────────────────────────────────────────┤
│ React components (kmd-web/react)                     │
│ Reader.tsx, DocumentShell.tsx, Toast, ErrorBoundary  │
│ Depends on: core + browser runtime + styles          │
├─────────────────────────────────────────────────────┤
│ Browser runtime (kmd-web/browser)                    │
│ domMorph, anchorNavigation, codeBlockEnhancements,   │
│ renderMermaidPlaceholders                            │
│ Depends on: core                                      │
├─────────────────────────────────────────────────────┤
│ Optional heavy features (kmd-web/core, lazy)         │
│ Shiki, Mermaid (rehype plugin), KaTeX CSS             │
│ Depends on: core                                      │
├─────────────────────────────────────────────────────┤
│ Optional design pipeline (kmd-web/core, lazy)        │
│ design/detect, design/extract, design/merge,         │
│ design/resolve, design/enrich, design/ir             │
│ Depends on: core                                      │
├─────────────────────────────────────────────────────┤
│ Core (kmd-web)                                       │
│ parse pipeline, sanitize, link policy, hast utils,   │
│ parse cache, remark plugins                           │
│ Zero DOM. Zero Tauri. Zero browser globals.          │
└─────────────────────────────────────────────────────┘
```

### Layer rules

1. **Core is DOM-free.** Core must not import `document`, `window`, `navigator`, `Worker`, `MutationObserver`, `IntersectionObserver`, `ResizeObserver`, `requestAnimationFrame`, or any browser-only API. If a function currently touches the DOM, it belongs in the browser runtime layer.

2. **Core has no runtime detection.** `isTauriRuntime()` and any `__TAURI_INTERNALS__` checks belong in the product shell or adapter layer, never in core.

3. **Browser runtime depends only on core.** DOM utilities (morph, anchor nav, code enhancements, Mermaid render) may import from core but not from React or Tauri.

4. **React depends on core + browser runtime + styles.** React components may import DOM utilities and core types, but must not import Tauri directly. Platform behavior is injected via capability contracts (§3).

5. **Product shell owns all platform coupling.** Tauri imports, file access, path policy, updater, theme storage, and native IPC stay in the product repository. The library never imports `@tauri-apps/*`.

6. **Styles are raw CSS.** No CSS-in-JS. Styles import from `kmd-web/styles/*` subpath. Consumers can override via CSS custom properties.

7. **Heavy features are lazy.** Shiki, Mermaid, and KaTeX are dynamically `import()`-ed. They are never in the hot path of `renderMarkdown()`.

8. **Design pipeline is optional.** The `design/` subtree is a lazy-loaded optional feature. Consumers who only need Markdown rendering must not pay the bundle cost.

---

## 2. Package structure

Single `kmd-web` package with subpath exports. Graduate to scoped `@kmdr/*` packages only if divergence demands it.

| Subpath | Layer | Contains |
|---------|-------|----------|
| `kmd-web` | Core | `renderMarkdown()`, `RenderResult`, `OutlineEntry`, `RenderOptions`, `isSafeUrl()`, `sanitizeSchema`, `rehypeUrlPolicy`, `classifyRenderedLink()`, `normalizeExternalHref()`, `parseInternalHref()`, `getFragmentIdFromHref()`, hast utils, parse cache, remark plugins |
| `kmd-web/browser` | Browser runtime | `morphMarkdownBody()`, `findAnchorTarget()`, `scrollContainerToTarget()`, `enhanceCodeBlocks()`, `removeCodeBlockEnhancements()`, `renderMermaidPlaceholders()` |
| `kmd-web/react` | React | `Reader`, `DocumentShell`, `ToastProvider`, `useToast`, `ErrorBoundary`, `LoadingSkeleton` |
| `kmd-web/design` | Optional design | `detectDesignDocument()`, `runDesignPipeline()`, `DesignDocumentIR`, `DesignCatalog`, `DesignMode`, `exportHtml()`, `showcaseTheme` |
| `kmd-web/styles/*` | Styles | `tokens.css`, `reader.css`, `document-shell.css` |
| `kmd-web/worker` | Optional worker | `parseMarkdownInWorker()`, `terminateParseWorker()` |

**No Web Component subpath in v0.1.** Defer to a later ADR.

---

## 3. Capability contracts

Replace all platform coupling with narrow capability contracts injected at the product shell boundary. Each contract covers exactly one responsibility. Do not create a catch-all adapter.

### 3.1 Asset resolver

```typescript
interface AssetResolver {
  resolveImage(src: string, docPath: string): Promise<string | null>;
}
```

Replaces `resolveAssets.ts`. The product shell provides a Tauri-backed implementation; the browser default returns `null` (images are left as-is).

### 3.2 Link handler

```typescript
interface LinkHandler {
  openExternal(href: string): Promise<void>;
  openInternal(href: string, fragment: string | null): Promise<boolean>;
}
```

Replaces the Tauri link-handling code in `Reader.tsx`. Link classification (`classifyRenderedLink`) stays in core — only the action of opening a link is delegated.

### 3.3 Notification sink (optional)

```typescript
interface NotificationSink {
  notify(message: string, type: "success" | "error" | "info" | "warning"): void;
}
```

Replaces `useToast()` coupling in `Reader.tsx`. Optional: if not provided, the library is silent. The product shell wires this to its toast system.

### 3.4 Clipboard (optional)

```typescript
interface ClipboardProvider {
  copy(text: string): Promise<void>;
}
```

Replaces the `navigator.clipboard` / `document.execCommand("copy")` fallback in `codeBlockEnhancements.ts`. The browser default uses `navigator.clipboard` with `execCommand` fallback. The product shell may override with a Tauri-backed clipboard.

### 3.5 Injection points

Capabilities are injected via React context or component props — never via global state. The library exports a `KmdProvider` context that accepts capability contracts and makes them available to `Reader` and other components.

```tsx
<KmdProvider
  assetResolver={tauriAssetResolver}
  linkHandler={tauriLinkHandler}
  notificationSink={toastSink}
>
  <Reader content={content} filePath={filePath} />
</KmdProvider>
```

---

## 4. ESM-first export policy

The library is **ESM-only** for v0.1.

```json
{
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": { "import": "./dist/core/index.js", "types": "./dist/core/index.d.ts" },
    "./browser": { "import": "./dist/browser/index.js", "types": "./dist/browser/index.d.ts" },
    "./react": { "import": "./dist/react/index.js", "types": "./dist/react/index.d.ts" },
    "./design": { "import": "./dist/design/index.js", "types": "./dist/design/index.d.ts" },
    "./styles/*": "./dist/styles/*",
    "./worker": { "import": "./dist/worker/index.js", "types": "./dist/worker/index.d.ts" }
  }
}
```

- No CJS output. Add CJS only when a demonstrated consumer need arises.
- `sideEffects: ["**/*.css"]` — CSS files are not tree-shaken; all JS is pure.
- React is an optional peer dep (`peerDependenciesMeta.optional: true`).
- Worker subpath is ESM-only (workers require module type).

---

## 5. What stays in product repositories

| Responsibility | Owner | Reason |
|---------------|-------|--------|
| Native file access, path policy, URL policy enforcement | Rust backend (kmd, kmd-ios) | Platform-specific IPC |
| File watching, recent files, caching | Product shell | Tauri-specific |
| Theme storage (localStorage / iOS) | Product shell | Platform-specific storage |
| App entry, routing, window management | Product shell | Platform-specific |
| Updater | Product shell | Tauri updater |
| StoreKit, support panel, viewport height | kmd-ios only | iOS-only |
| Keyboard shortcuts | Product shell | App-level concern |
| Welcome screen | Product shell | App-level concern |
| `isTauriRuntime()` check | Product shell or adapter | Runtime detection not in library |
| CSP enforcement | Product shell / native config | Platform-level, not code-level |

---

## 6. Native file/path policy

Native file access and path policy remain in the Rust backend of each product repository. The library never touches the filesystem, never calls `invoke()`, and never checks `isTauriRuntime()`.

Image resolution, internal link resolution, and file opening are delegated to the product shell via capability contracts (§3). The library provides the browser default implementations; the product shell overrides them with Tauri-backed implementations.

---

## 7. Security boundaries

1. **Sanitize after parsing, not before.** The pipeline runs `remark → rehype → sanitize → stringify`. The sanitizer sees the final HTML, not the Markdown source.
2. **URL scheme allowlist** in core (`isSafeUrl()`). Blocks `javascript:`, `vbscript:`, `data:`, `file:`, custom schemes.
3. **Event handler stripping** in core (`rehypeUrlPolicy`). Strips all `on*` attributes.
4. **Link classification** in core (`classifyRenderedLink()`). Returns `fragment | internal | external | blocked`.
5. **Mermaid post-sanitization DOM insertion** is a security boundary. `renderMermaidPlaceholders()` injects `target.innerHTML = result.svg` after the HTML sanitizer has already run. The SVG output from Mermaid is not re-sanitized. This requires explicit downstream testing and sanitization review. See ADR 001 §8.
6. **CSP enforcement** is platform-level, not library-level. Consumers must set their own CSP.
7. **No privileged Tauri commands exposed to rendered content.** The library never calls `invoke()` — all platform actions go through capability contracts.

---

## 8. Migration rule

**Refactor package boundaries before publication. Delete downstream copies only after package-backed parity.**

1. Create `kmd-web` repo with the layer structure defined in §2.
2. Copy shared files into the correct layers. **Refactor during copy**: move DOM-coupled code to browser layer, remove `isTauriRuntime()` from core, replace Tauri coupling with capability contracts.
3. Build the library (`tsc --emitDeclarationOnly` + Vite library mode).
4. Run the library's own test suite (ported from kmd's tests).
5. Add `kmd-web` as a dependency in kmd's `package.json`.
6. Replace local imports with `import { ... } from "kmd-web"`.
7. Run kmd's full test suite — all tests must pass.
8. Run `npm run build` — must succeed.
9. **Only then** delete the local copies from kmd.
10. Repeat for kmd-ios: add dependency, replace imports, run 770 tests, build, delete.

**No production behavior changes during migration.** The library code preserves exact rendering behavior. The refactor changes import paths and coupling boundaries, not rendering logic.

---

## 9. Unity port

kmd-unity is a C# rewrite (Markdig + UIToolkit). It shares zero code with the TypeScript codebase. It shares the design spec / IR types (as a schema/JSON file) and feature parity tracked via documentation, not code. The library does not target Unity.

---

## 10. Future features

New features land in the appropriate layer:

- **Parser/sanitize/pipeline changes** → core → all JS platforms get them via npm update.
- **DOM utility changes** → browser runtime → all JS platforms with DOM access.
- **React component changes** → react → kmd and kmd-ios both get them.
- **Platform-specific features** (file open, StoreKit, native menus) → product shell, via capability contracts.
- **Unity** → reimplement in C# using the same spec/IR types.

---

## References

- `docs/planning/19-kmd-web-library-research.md` — original research (superseded)
- `docs/planning/20-kmd-web-extraction-inventory.md` — file-by-file inventory
- `docs/adr/001-renderresult-shape-and-package-boundaries.md` — ADR for initial API shape