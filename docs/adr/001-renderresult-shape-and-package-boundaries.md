# ADR 001: RenderResult Shape, Capability Contracts, Package Boundaries, and Migration Rule

> Status: Revised (v2)
> Date: 2026-07-22
> Task: KWEB-001
> Binding reference: `docs/planning/17-kmd-ecosystem-north-star.md`

## Context

The `kmd` desktop app and `kmd-ios` fork share ~90% of their TypeScript frontend code, but divergence is accelerating. The plan is to extract shared code into a `kmd-web` npm library so both apps consume it via npm instead of maintaining parallel copies.

The extraction inventory (see `docs/planning/20-kmd-web-extraction-inventory.md`) identified:

- **32 identical production files** across parser, reader, and design components
- **16 diverged files** (13 functional, 3 whitespace-only)
- **1 kmd-only file** (`remark-wikilinks.ts`)
- **11 kmd-ios-only files** (iOS adapter, StoreKit, viewport, preview)
- **Tauri coupling** concentrated in `Reader.tsx` (6 dynamic import sites), `resolveAssets.ts` (1 file), `App.tsx` (heavy), `updater.ts`, `useDocumentState.ts`, `useRecentFiles.ts`
- **Toast coupling** in `Reader.tsx` via `useToast()` React context
- **Bundler-specific** worker bridge using `new URL(..., import.meta.url)`
- **DOM coupling** in `rehype-mermaid.ts` (render step), `domMorph.ts`, `anchorNavigation.ts`, `codeBlockEnhancements.ts`
- **Mermaid post-sanitization DOM insertion** — `renderMermaidPlaceholders()` injects `target.innerHTML = result.svg` after the sanitizer has run (security boundary, §8)

The North Star (`docs/planning/17-kmd-ecosystem-north-star.md`) fixes the layer model. This ADR defines the initial public API shape and migration rule within those boundaries.

## Decision

### 1. RenderResult shape

The public API uses `RenderResult` rather than exposing the implementation's
current `ParseResult` name. The initial contract is serializable and leaves room
for diagnostics, assets, metadata, and feature negotiation without exposing the
unified/HAST implementation:

```typescript
export interface RenderResult {
  html: string;
  outline: OutlineEntry[];
  diagnostics: Diagnostic[];
  assets: AssetReference[];
  metadata: DocumentMetadata;
  detectedFeatures: DetectedFeatures;
  rendererVersion: string;
}

export interface OutlineEntry {
  text: string;
  level: number;
  id: string;
}

export interface RenderOptions {
  features?: Partial<FeatureOptions>;
}
```

The library exports `renderMarkdown(content: string, options?: RenderOptions): Promise<RenderResult>`.
The exact supporting type fields and migration compatibility are finalized and
contract-tested in KWEB-004; the unified/HAST AST remains private. The internal
name `parseMarkdown` can remain as a private alias during transition.

### 2. Layer boundaries (per North Star)

The library has four layers with strict dependency rules. Each layer may only import from layers below it.

| Layer | Subpath | DOM? | Tauri? | Browser globals? |
|-------|---------|------|--------|-------------------|
| Core | `kmd-web` | No | No | No |
| Browser runtime | `kmd-web/browser` | Yes | No | Yes |
| React | `kmd-web/react` | Yes (via browser) | No | Yes (via browser) |
| Optional design | `kmd-web/design` | Split pure transforms from React/DOM presentation | No | Presentation only |
| Optional worker | `kmd-web/worker` | No | No | `self` (worker scope) |
| Styles | `kmd-web/styles/*` | N/A | N/A | N/A |

**Core is DOM-free.** `isTauriRuntime()` and any `__TAURI_INTERNALS__` checks belong in the product shell, never in core. DOM-coupled code (`domMorph.ts`, `anchorNavigation.ts`, `codeBlockEnhancements.ts`, `renderMermaidPlaceholders()`) belongs in the browser runtime layer.

See the North Star's **kmd-web repository shape** and **Layer contracts** sections
for the complete layer model and target package structure.

### 3. Narrow capability contracts

Replace all platform coupling with narrow capability contracts. Each contract covers exactly one responsibility. No catch-all adapter.

```typescript
interface AssetResolver {
  resolveImage(src: string, docPath: string): Promise<string | null>;
}

interface LinkHandler {
  openExternal(href: string): Promise<void>;
  openInternal(href: string, fragment: string | null): Promise<boolean>;
}

interface NotificationSink {
  notify(message: string, type: "success" | "error" | "info" | "warning"): void;
}

interface ClipboardProvider {
  copy(text: string): Promise<void>;
}
```

**What stays in core:** Link classification (`classifyRenderedLink`), URL safety checks (`isSafeUrl`), sanitize schema, URL policy plugin. These are pure TS with no platform deps.

**What moves to product repos:** `resolveAssets.ts` (becomes `AssetResolver` impl), `handleInternalLink` in Reader.tsx (becomes `LinkHandler.openInternal`), `openExternalLink` fallback (becomes `LinkHandler.openExternal`), `useToast` coupling (becomes `NotificationSink`), `navigator.clipboard` usage (becomes `ClipboardProvider`).

**Browser defaults** are provided in `kmd-web/browser/defaults.ts`:
- `defaultLinkHandler` — `window.open` for external, no-op for internal
- `defaultClipboardProvider` — `navigator.clipboard` with `execCommand` fallback

Capabilities are injected via React context (`KmdProvider`), never via global state.

The signatures above are architectural sketches, not the final public type
declarations. KWEB-004 defines their request/response types and verifies that
capabilities can only execute actions already classified by core policy. See the
North Star's **Host capabilities** section.

### 4. ESM-only export policy

The library is **ESM-only** for v0.1. No CJS output. Add CJS only when a demonstrated consumer need arises.

```json
{
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": { "import": "./dist/core/index.js", "types": "./dist/core/index.d.ts" },
    "./browser": { "import": "./dist/browser/index.js", "types": "./dist/browser/index.d.ts" },
    "./react": { "import": "./dist/react/index.js", "types": "./dist/react/index.d.ts" },
    "./design": { "import": "./dist/design/index.js", "types": "./dist/design/index.d.ts" },
    "./highlighting": { "import": "./dist/highlighting/index.js", "types": "./dist/highlighting/index.d.ts" },
    "./mermaid": { "import": "./dist/mermaid/index.js", "types": "./dist/mermaid/index.d.ts" },
    "./math": { "import": "./dist/math/index.js", "types": "./dist/math/index.d.ts" },
    "./styles.css": "./dist/styles/index.css",
    "./styles/*": "./dist/styles/*",
    "./worker": { "import": "./dist/worker/index.js", "types": "./dist/worker/index.d.ts" }
  }
}
```

- `sideEffects: ["**/*.css"]` — CSS files are not tree-shaken; all JS is pure.
- React is an optional peer dep (`peerDependenciesMeta.optional: true`).
- No Web Component subpath in v0.1.

See the North Star's **Versioning and release model** section for the governing
export and compatibility policy.

### 5. Package boundaries

The repository enforces internal workspace boundaries while the initial public
release may expose a single `kmd-web` convenience package with subpath exports.
See the North Star's **kmd-web repository shape** section. Package splits are
driven by measured dependency, size, ownership, or release-cadence needs.

**What stays in product repositories (not in the library):**
- `App.tsx`, `main.tsx`, `App.css`, `global.css` — app shell
- `theme.ts` — theme storage (platform-specific)
- `updater.ts` — Tauri updater
- `useDocumentState.ts` — document state (Tauri IPC)
- `useRecentFiles.ts` — recent files (Tauri IPC)
- `useKeyboardShortcuts.ts` — keyboard shortcuts
- `WelcomeScreen.tsx` — welcome screen
- `resolveAssets.ts` — image resolution (becomes `AssetResolver` impl)
- `tauri-types.d.ts` — Tauri type helpers
- `platform.ts` (`isTauriRuntime`) — runtime detection (product shell/adapter)
- All iOS-only files (StoreKit, SupportPanel, viewportHeight, preview)

**Native file/path policy stays in product repositories.** The Rust backend owns file access, path policy, URL policy enforcement, file watching, and caching. The library never touches the filesystem.

### 6. Migration rule

**Refactor package boundaries before publication. Delete downstream copies only after package-backed parity.**

1. Create `kmd-web` repo with the layer structure from the North Star.
2. Copy shared files into the correct layers. **Refactor during copy**: move DOM-coupled code to browser layer, remove `isTauriRuntime()` from core, replace Tauri coupling with capability contracts.
3. Build the library and run its test suite.
4. Add `kmd-web` as a dependency in kmd's `package.json`.
5. Wire `KmdProvider` with Tauri-backed capability implementations.
6. Replace local imports with `kmd-web` imports.
7. Run kmd's full test suite — all 730 tests must pass.
8. Run `npm run build` — must succeed.
9. **Only then** delete the local copies from kmd.
10. Repeat for kmd-ios.

**No production behavior changes during migration.** The refactor changes import paths and coupling boundaries, not rendering logic. This ensures the library never publishes Tauri/DOM/product coupling as public API.

See the implementation plan (`docs/planning/18-kmd-web-implementation-plan.md`) for phase-by-phase details.

---

## 7. Consequences

### Positive

- Single source of truth for parsing, sanitizing, and rendering across all JS platforms.
- Feature propagation via npm update instead of manual porting.
- kmd-ios fork is eliminated — becomes a thin app shell.
- DOM-free core enables future non-browser consumers (SSR, server-side rendering).
- Narrow capability contracts keep each platform concern isolated.

### Negative

- Version coordination overhead: changes to the library need a release before apps can consume them.
- DocumentShell divergence (desktop vs mobile) requires a shared base + platform variants or flexible props.
- Worker bridge remains bundler-specific — consumers without Vite/webpack must use the sync fallback.
- ESM-only may break consumers using CJS import syntax (acceptable for v0.1; revisit when a real consumer needs CJS).

### Risks

| Risk | Mitigation |
|------|------------|
| DocumentShell divergence blocks extraction | Extract shared base first; platform-specific shells stay in product repos |
| Worker `new URL()` pattern breaks non-Vite consumers | Worker is optional subpath; sync fallback already exists |
| A capability needs another responsibility | Add or version a separate narrow capability; do not grow a catch-all adapter |
| Test divergence after extraction | Library ships its own test suite; product repos test capability wiring |

---

## 8. Mermaid post-sanitization DOM insertion — security boundary

`renderMermaidPlaceholders()` (currently in `src/parser/rehype-mermaid.ts`, lines 57-94) injects Mermaid's SVG output via `target.innerHTML = result.svg` **after** the HTML sanitizer (`rehype-sanitize`) has already run on the parsed HTML. This means:

1. The Mermaid SVG is not re-sanitized by `rehype-sanitize`.
2. Mermaid's output could theoretically contain unsafe SVG elements (scripts, external references).
3. The sanitize schema allows SVG elements (`svg`, `path`, `g`, `text`, etc.) because Mermaid needs them, but this also means a compromised Mermaid library could inject arbitrary SVG.

**Required downstream actions:**
- The `kmd-web` library must document this as a known security boundary in its README.
- Consumers must apply a restrictive CSP as defense in depth; CSP is not a substitute for sanitizing generated SVG.
- The `renderMermaidPlaceholders()` function must be in the browser runtime layer (not core) so it is clear this is a DOM-level security surface.
- Before the Mermaid feature is published, its SVG output must pass through a dedicated strict SVG sanitization boundary that removes scripts, event handlers, external references, unsafe URLs, and unsupported elements/attributes before DOM insertion.
- Add malicious Mermaid/SVG fixtures that verify scripts, event handlers, external references, unsafe URLs, and active embedding elements cannot survive. A script-only assertion is insufficient.

---

## Verification

- Baseline tests captured: kmd 730/730 passed, kmd-ios 770/770 passed.
- TypeScript compilation clean on both repos.
- `npm run build` (`tsc -b && vite build`) completed successfully with bundle-size warnings. Does not require Rust/Tauri compilation.
- No production files changed — this ADR and the inventory are docs-only.

## Changelog

- **v2 (2026-07-22):** Revised per reviewer findings. Aligned with North Star layer model. Removed CJS/dual-format. Replaced catch-all KmdAdapter with narrow capability contracts. Rewrote migration rule to refactor-before-publish. Added Mermaid post-sanitization security boundary (§8). Removed `isTauriRuntime` from core.
- **v1 (2026-07-22):** Initial version. Had DOM morphing in core, catch-all KmdAdapter, CJS dual-format, publish-then-refactor migration.
