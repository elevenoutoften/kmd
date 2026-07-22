# ADR 001: RenderResult Shape, Capability Approach, Package Boundaries, and Migration Rule

> Status: Proposed
> Date: 2026-07-22
> Task: KWEB-001

## Context

The `kmd` desktop app and `kmd-ios` fork share ~90% of their TypeScript frontend code, but divergence is accelerating. The plan is to extract shared code into a `kmd-web` npm library so both apps consume it via npm instead of maintaining parallel copies.

The extraction inventory (see `docs/planning/18-kmd-web-extraction-inventory.md`) identified:

- **32 identical production files** across parser, reader, and design components
- **6 diverged files** needing reconciliation (3 functional, 3 whitespace-only)
- **1 kmd-only file** (`remark-wikilinks.ts`)
- **11 kmd-ios-only files** (iOS adapter, StoreKit, viewport, preview)
- **Tauri coupling** concentrated in `Reader.tsx` (6 dynamic import sites), `resolveAssets.ts` (1 file), `App.tsx` (heavy), `updater.ts`, `useDocumentState.ts`, `useRecentFiles.ts`
- **Toast coupling** in `Reader.tsx` via `useToast()` React context
- **Bundler-specific** worker bridge using `new URL(..., import.meta.url)`
- **DOM coupling** in `rehype-mermaid.ts` (render step), `domMorph.ts`, `anchorNavigation.ts`, `codeBlockEnhancements.ts`

## Decision

### 1. RenderResult shape

The current `ParseResult` interface is the initial public API:

```typescript
export interface ParseResult {
  html: string;
  outline: OutlineEntry[];
  hasMath: boolean;
}

export interface OutlineEntry {
  text: string;
  level: number;
  id: string;
}
```

**Decision:** Rename to `RenderResult` in the library's public API to distinguish parsing input from rendering output. The shape stays identical for v0.1.

```typescript
// kmd-web public API
export interface RenderResult {
  html: string;
  outline: OutlineEntry[];
  hasMath: boolean;
}
```

`ParseOptions` becomes `RenderOptions`:

```typescript
export interface RenderOptions {
  skipShiki?: boolean;
  skipMermaid?: boolean;
}
```

The library exports `renderMarkdown(content: string, options?: RenderOptions): Promise<RenderResult>`. The internal name `parseMarkdown` can remain as a private alias during transition.

### 2. Narrow capability approach

Replace Tauri coupling with a narrow adapter interface. The adapter is injected via props (React) or constructor options (core). All platform-specific behavior goes through the adapter — no `isTauriRuntime()` checks in library code.

```typescript
export interface KmdAdapter {
  /** Resolve a relative image src to a loadable URL. Return null to skip. */
  resolveImage?(src: string, docPath: string): Promise<string | null>;

  /** Open an external URL. Defaults to window.open() if not provided. */
  openExternalLink?(href: string): Promise<void>;

  /** Open an internal link. Return true if handled. */
  openInternalLink?(href: string, fragment: string | null): Promise<boolean>;

  /** Show a toast notification. Optional — library is silent if not provided. */
  onToast?(message: string, type: "success" | "error" | "info" | "warning"): void;
}
```

**What stays in the library:** Link classification (`classifyRenderedLink`), URL safety checks (`isSafeUrl`), DOM morphing, anchor navigation, code block enhancements, Mermaid placeholder rendering.

**What moves to product repos:** `resolveAssets.ts` (becomes `adapter.resolveImage`), `handleInternalLink` in Reader.tsx (becomes `adapter.openInternalLink`), `openExternalLink` fallback (becomes `adapter.openExternalLink`), `useToast` coupling (becomes `adapter.onToast`).

**Default adapter:** A browser default adapter that uses `window.open()` for external links, `navigator.clipboard` for copy, and no-ops for image resolution and internal links. This makes the library usable standalone in any browser.

### 3. ESM-first export policy

The library is **ESM-first** with CJS fallback via tsup dual-format builds.

```json
{
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": {
      "import": "./dist/core/index.js",
      "require": "./dist/core/index.cjs",
      "types": "./dist/core/index.d.ts"
    },
    "./react": {
      "import": "./dist/react/index.js",
      "require": "./dist/react/index.cjs",
      "types": "./dist/react/index.d.ts"
    },
    "./styles/*": "./dist/styles/*",
    "./worker": {
      "import": "./dist/worker/index.js",
      "types": "./dist/worker/index.d.ts"
    }
  }
}
```

- `sideEffects: ["**/*.css"]` — CSS files are not tree-shaken; all JS is pure.
- React is an optional peer dep (`peerDependenciesMeta.optional: true`).
- Worker subpath is ESM-only (workers are not CJS-compatible).
- No Web Component subpath in v0.1 — defer to a later ADR.

### 4. Package boundaries

Single `kmd-web` package with subpath exports (Pattern B from the research doc). Graduate to scoped `@kmdr/*` packages only if divergence demands it.

| Subpath | Contains | Consumers |
|---------|----------|-----------|
| `kmd-web` (core) | Parse pipeline, sanitize, link policy, DOM morphing, anchor nav, code block enhancements, design pipeline, worker bridge | All JS platforms |
| `kmd-web/react` | Reader component, DocumentShell, Toast system, ErrorBoundary, LoadingSkeleton, design components | kmd, kmd-ios |
| `kmd-web/worker` | Worker bridge (optional, ESM-only) | kmd, kmd-ios (optional) |
| `kmd-web/styles/*` | tokens.css, reader.css, document-shell.css | All JS platforms |

**What stays in product repositories (not in the library):**
- `App.tsx`, `main.tsx`, `App.css`, `global.css` — app shell
- `theme.ts` — theme storage (adapter handles this)
- `updater.ts` — Tauri updater
- `useDocumentState.ts` — document state management (Tauri IPC)
- `useRecentFiles.ts` — recent files (Tauri IPC)
- `useKeyboardShortcuts.ts` — keyboard shortcuts
- `WelcomeScreen.tsx` — welcome screen
- `resolveAssets.ts` — image resolution (becomes adapter)
- `tauri-types.d.ts` — Tauri type helpers
- All iOS-only files (StoreKit, SupportPanel, viewportHeight, preview)

**Native file/path policy stays in product repositories.** The Rust backend owns file access, path policy, URL policy enforcement, file watching, and caching. The library never touches the filesystem.

### 5. Migration rule

**Downstream copies are deleted only after parity is verified.**

1. Copy shared files to `kmd-web` package.
2. Publish `kmd-web` to npm (or local link).
3. Add `kmd-web` dependency to kmd `package.json`.
4. Replace local imports with `import { ... } from "kmd-web"`.
5. Run full test suite — all 730 tests must pass.
6. Verify build and manual smoke test.
7. **Only then** delete the local copies from kmd.
8. Repeat for kmd-ios: add dependency, replace imports, run 770 tests, verify, delete.

**No production behavior changes during migration.** The library code is a verbatim copy until parity is proven. Refactoring (adapter pattern, RenderResult rename) happens after the copies are deleted and tests pass.

---

## Consequences

### Positive

- Single source of truth for parsing, sanitizing, and rendering across all JS platforms.
- Feature propagation via npm update instead of manual porting.
- kmd-ios fork is eliminated — becomes a thin app shell.
- New platforms (kmd-web, kmd-unity web viewer) can consume the library directly.

### Negative

- Version coordination overhead: changes to the library need a release before apps can consume them.
- The adapter interface adds indirection for platform-specific behavior.
- DocumentShell divergence (desktop vs mobile) requires either a shared base + platform variants or a flexible prop API.
- Worker bridge remains bundler-specific — consumers without Vite/webpack must use the sync fallback.

### Risks

| Risk | Mitigation |
|------|------------|
| DocumentShell divergence blocks extraction | Extract shared base first; platform-specific shells stay in product repos |
| Worker `new URL()` pattern breaks non-Vite consumers | Worker is optional subpath; sync fallback already exists |
| Adapter interface too narrow for future features | Design as extensible interface with optional methods; add fields in minor versions |
| Test divergence after extraction | Library ships its own test suite; product repos test adapter wiring |

## Verification

- Baseline tests captured: kmd 730/730 passed, kmd-ios 770/770 passed.
- TypeScript compilation clean on both repos.
- No production files changed — this ADR and the inventory are docs-only.