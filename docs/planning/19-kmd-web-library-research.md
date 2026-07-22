# kmd-web: Reusable Web Library Research

> Status: Informative historical research. The binding
> [ecosystem North Star](17-kmd-ecosystem-north-star.md),
> [implementation plan](18-kmd-web-implementation-plan.md), and
> [ADR 001](../adr/001-renderresult-shape-and-package-boundaries.md) supersede
> proposals in this document where they differ, including the catch-all
> `KmdAdapter`, package boundaries, and release format.

## Goal

Extract kmd's Markdown rendering engine into a lightweight, framework-agnostic npm library (`kmd-web`) that can be embedded in any website or project. Plan the architecture so future features (fonts, editor mode, etc.) propagate across all platforms: kmd desktop, kmd-ios, kmd-unity, and kmd-web.

---

## 1. Current Architecture Audit

### What kmd has today

```
src/
  parser/           ← Pure TypeScript, zero Tauri deps
    index.ts          unified pipeline: remark→rehype→HTML string + outline
    sanitize.ts       rehype URL policy + sanitize schema
    rehype-shiki.ts   syntax highlighting (lazy lang loading)
    rehype-mermaid.ts mermaid → placeholder divs
    rehype-copy-button.ts
    parse-worker.ts   Web Worker entry
    parse-worker-bridge.ts  Worker manager (uses new URL() — bundler-specific)
    parse-cache.ts    LRU parse cache
    hast-utils.ts
    design/            DESIGN.md pipeline (detect→extract→merge→resolve→enrich→IR)
  reader/           ← React + DOM, minimal Tauri coupling
    Reader.tsx         main component (Tauri calls are dynamic imports, guarded by isTauriRuntime())
    DocumentShell.tsx  outline sidebar + scroll container (zero Tauri deps)
    domMorph.ts        block-level DOM diffing (pure DOM)
    anchorNavigation.ts  pure DOM
    linkPolicy.ts      pure TypeScript
    codeBlockEnhancements.ts  pure DOM
    resolveAssets.ts   ← Tauri IPC (resolve_asset for relative images)
  theme.ts          ← localStorage-based (could abstract)
  tokens.css        ← CSS custom properties (pure CSS)
  Reader.css        ← content styles (pure CSS)
  DocumentShell.css ← chrome styles (pure CSS)
  App.tsx           ← Tauri-specific: window show, file open, updates, StoreKit
  hooks/            ← Tauri-specific: useDocumentState, useRecentFiles, useKeyboardShortcuts
  updater.ts        ← Tauri updater
```

### Coupling map

| Module | Tauri deps? | Reusable as-is? |
|--------|------------|-----------------|
| `parser/index.ts` | None | ✅ Yes |
| `parser/sanitize.ts` | None | ✅ Yes |
| `parser/rehype-*.ts` | None | ✅ Yes |
| `parser/design/*` | None | ✅ Yes |
| `parser/parse-worker-bridge.ts` | None, but uses `new URL()` | ⚠️ Needs bundler abstraction |
| `reader/DocumentShell.tsx` | None | ✅ Yes |
| `reader/Reader.tsx` | Dynamic imports, guarded | ⚠️ Needs platform adapter |
| `reader/domMorph.ts` | None | ✅ Yes |
| `reader/linkPolicy.ts` | None | ✅ Yes |
| `reader/codeBlockEnhancements.ts` | None | ✅ Yes |
| `reader/resolveAssets.ts` | Tauri IPC | ❌ Platform-specific |
| `theme.ts` | localStorage | ⚠️ Abstract storage |
| `tokens.css` / `Reader.css` | None | ✅ Yes |
| `App.tsx` | Heavy Tauri | ❌ App shell, not library |

**~70% of the codebase is already platform-independent.**

### Cross-platform divergence today

kmd-ios is a **fork** of kmd — it has already diverged:
- Missing: `domMorph.ts`, `codeBlockEnhancements.ts`, `rehype-copy-button.ts`
- Added: `ios-security.test.ts`, StoreKit/purchase system, iOS WebView security hardening
- Reader.tsx is simpler (no two-phase render, no internal link resolution)

kmd-unity is a **complete rewrite** in C# (Markdig + UIToolkit) — shares zero code with the TypeScript codebase.

---

## 2. Library Architecture Patterns

### Pattern A: Headless Core + Platform Adapters (Recommended)

```
@kmdr/core        ← Pure TypeScript: parse, sanitize, outline, design pipeline
@kmdr/react       ← React components: <MarkdownReader>, <DocumentShell>, hooks
@kmdr/web         ← Framework-agnostic: Web Component <kmd-reader>, vanilla JS API
@kmdr/styles      ← CSS: tokens.css, Reader.css, DocumentShell.css
@kmdr/worker      ← Optional: Web Worker parsing bridge

kmd (app)          ← Tauri desktop app, depends on @kmdr/core + @kmdr/react
kmd-ios (app)      ← Tauri iOS app, depends on @kmdr/core + @kmdr/react
kmd-unity (port)   ← C# port, separate (shares design spec, not code)
```

**How it works:**
- `@kmdr/core` exports pure functions: `parseMarkdown()`, `detectDesignDocument()`, `runDesignPipeline()`, sanitize schema, link policy, hast utils
- `@kmdr/react` exports React components that use `@kmdr/core` and accept platform adapters via props/context
- `@kmdr/web` wraps `@kmdr/core` in a Web Component (`<kmd-reader>`) for vanilla JS / framework-agnostic use
- Platform-specific code (file access, image resolution, link handling) is injected via an adapter interface

**Adapter interface:**
```typescript
interface KmdAdapter {
  resolveImage?(src: string, docPath: string): Promise<string>;
  openExternalLink?(href: string): Promise<void>;
  openInternalLink?(href: string, fragment: string | null): Promise<void>;
  getTheme?(): Theme;
  setTheme?(theme: Theme): void;
  copyToClipboard?(text: string): Promise<void>;
}
```

**Why this pattern:**
- kmd's parser is already pure TypeScript — zero refactoring needed
- Reader.tsx already guards Tauri calls with `isTauriRuntime()` — just replace with adapter
- iOS and desktop share the same React frontend → they both consume `@kmdr/react`
- Web-only users use `@kmdr/web` (Web Component) or `@kmdr/react` directly
- Unity stays separate (C# port) but shares the design spec / IR types

### Pattern B: Single package with subpath exports

```
kmd-web
  /core      ← parse, sanitize, etc.
  /react     ← React components
  /web       ← Web Component
  /styles    ← CSS
  /worker    ← Worker bridge
```

```json
{
  "exports": {
    ".":          "./dist/core/index.js",
    "./react":    "./dist/react/index.js",
    "./web":      "./dist/web/index.js",
    "./styles/*": "./dist/styles/*",
    "./worker":   "./dist/worker/index.js"
  }
}
```

**Pros:** simpler, one package, one version
**Cons:** users who only want the parser still pull React as a dep unless carefully tree-shaken

### Recommendation: Start with Pattern B, graduate to A

Start with a single `kmd-web` package with subpath exports. If the React and Web Component versions diverge enough, split into `@kmdr/core` + `@kmdr/react` + `@kmdr/web` later. The subpath export structure makes this split trivial.

---

## 3. Package Structure

```
kmd-web/
  package.json
  tsconfig.json
  tsup.config.ts          ← build tool (dual ESM/CJS)
  src/
    core/
      index.ts            ← re-exports public API
      parse.ts            ← parseMarkdown() (from kmd/src/parser/index.ts)
      sanitize.ts         ← sanitize schema, URL policy
      outline.ts          ← outline extraction
      hast-utils.ts
      types.ts            ← ParseResult, OutlineEntry, ParseOptions, KmdAdapter
      design/
        index.ts
        detect.ts
        extract/
        merge.ts
        resolve.ts
        enrich.ts
        cache.ts
        ir.ts
    react/
      index.ts            ← <MarkdownReader>, <DocumentShell>, useMarkdown()
      MarkdownReader.tsx  ← refactored Reader.tsx (adapter-based)
      DocumentShell.tsx
      MarkdownReader.css
      DocumentShell.css
    web/
      index.ts            ← <kmd-reader> custom element
      KmdReaderElement.ts ← Web Component definition
    styles/
      tokens.css          ← theme tokens (dark/light)
      reader.css          ← content styles
    worker/
      index.ts            ← worker bridge (abstracted)
      parse-worker.ts     ← worker entry
    adapter/
      default.ts          ← browser default adapter (window.open, navigator.clipboard)
      types.ts            ← KmdAdapter interface
  dist/                   ← built output
  README.md
```

### package.json (key fields)

```json
{
  "name": "kmd-web",
  "version": "0.1.0",
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
    "./web": {
      "import": "./dist/web/index.js",
      "require": "./dist/web/index.cjs",
      "types": "./dist/web/index.d.ts"
    },
    "./styles/*": "./dist/styles/*",
    "./worker": {
      "import": "./dist/worker/index.js",
      "require": "./dist/worker/index.cjs",
      "types": "./dist/worker/index.d.ts"
    }
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "react-dom": { "optional": true }
  }
}
```

- `sideEffects: ["**/*.css"]` — tells bundlers CSS files have side effects (don't tree-shake them), but all JS is pure
- React is an optional peer dep — `@kmdr/web` (Web Component) doesn't need React
- Dual ESM/CJS via tsup

---

## 4. Build Tool: tsup

[tsup](https://tsup.egoist.dev/) is the standard for TypeScript library builds in 2025:
- Built on esbuild — fast
- Dual ESM/CJS output
- TypeScript declarations
- Zero config for simple cases

```ts
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/core/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    outDir: 'dist/core',
  },
  {
    entry: ['src/react/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    external: ['react', 'react-dom'],
    outDir: 'dist/react',
  },
  {
    entry: ['src/web/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'dist/web',
  },
  {
    entry: ['src/worker/index.ts'],
    format: ['esm'],
    dts: true,
    outDir: 'dist/worker',
  },
]);
```

CSS files are copied as-is (not bundled) — consumers import them directly via subpath exports.

---

## 5. Public API Design

### Core (framework-agnostic)

```typescript
import { parseMarkdown, detectDesignDocument } from 'kmd-web';

const result = await parseMarkdown('# Hello\n\nWorld');
// → { html: '<h1 id="hello">...</h1>', outline: [...], hasMath: false }

const detection = detectDesignDocument(content);
// → { score: 8, signals: [...], threshold: 5 }
```

### React

```tsx
import { MarkdownReader } from 'kmd-web/react';
import 'kmd-web/styles/tokens.css';
import 'kmd-web/styles/reader.css';

function App() {
  return (
    <MarkdownReader
      content={markdownString}
      adapter={myAdapter}  // optional: for custom link/image handling
    />
  );
}
```

### Web Component (framework-agnostic)

```html
<script type="module" src="https://esm.sh/kmd-web/web"></script>
<link rel="stylesheet" href="https://esm.sh/kmd-web/styles/tokens.css">
<link rel="stylesheet" href="https://esm.sh/kmd-web/styles/reader.css">

<kmd-reader content="# Hello World"></kmd-reader>
```

```javascript
const reader = document.querySelector('kmd-reader');
reader.content = '# Updated content';
reader.addEventListener('kmd:link-click', (e) => {
  // handle link clicks
});
```

### Vanilla JS (no framework, no Web Component)

```javascript
import { parseMarkdown } from 'kmd-web';
import 'kmd-web/styles/tokens.css';
import 'kmd-web/styles/reader.css';

const { html, outline } = await parseMarkdown(content);
document.querySelector('#reader').innerHTML = html;
```

---

## 6. Cross-Platform Feature Propagation

### The problem

Today, features are developed in kmd (desktop), then manually ported to kmd-ios (fork), and separately reimplemented in kmd-unity (C#). Adding a feature like "custom fonts" or "editor mode" means touching 3+ repos with different languages.

### Solution: Shared core + adapter pattern

```
                    ┌─────────────────┐
                    │  @kmdr/core     │  ← Single source of truth
                    │  (TypeScript)   │     parse, sanitize, design IR, types
                    └────┬────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼─────┐  ┌─────▼─────┐  ┌────▼──────┐
    │ @kmdr/    │  │  kmd app  │  │ kmd-ios  │
    │ react     │  │ (Tauri)   │  │ (Tauri)   │
    │ (shared)  │  │           │  │           │
    └───────────┘  └───────────┘  └───────────┘
                         │
    ┌─────────────┐      │
    │ @kmdr/web   │      │
    │ (Web Comp)  │      │
    └─────────────┘     │
                        │
              ┌─────────▼──────────┐
              │  kmd-unity (C#)     │  ← Separate, shares spec/types
              │  Markdig + UIToolkit│     not code
              └────────────────────┘
```

**Feature flow:**

1. **Parser/sanitize/design pipeline changes** → make in `@kmdr/core` → all JS platforms get it automatically via npm update
2. **React component changes** → make in `@kmdr/react` → kmd and kmd-ios both get it
3. **Platform-specific features** (file open, StoreKit, native menus) → implement in each app's adapter, core stays untouched
4. **Unity** → shares the IR types / design spec document, reimplements in C#. Feature parity tracked via spec, not code.

### Adding "custom fonts" everywhere

1. Add font-loading abstraction to `@kmdr/core` (type: `FontConfig`, function: `resolveFont()`)
2. Add font CSS variables to `@kmdr/styles/tokens.css`
3. Add `<FontPicker>` to `@kmdr/react` (optional component)
4. kmd desktop: adapter loads system fonts + bundled fonts
5. kmd-ios: adapter loads iOS system fonts + bundled fonts
6. kmd-web: adapter loads Google Fonts / user-provided fonts
7. kmd-unity: reimplement in C# using the same `FontConfig` type spec

### Adding "editor mode"

1. Add editor types to `@kmdr/core` (AST manipulation, edit operations)
2. Add `<MarkdownEditor>` to `@kmdr/react` (wraps `<MarkdownReader>` + textarea/CodeMirror)
3. All JS platforms get editor mode via npm update
4. kmd-unity: reimplement using UIToolkit text fields + Markdig AST

---

## 7. Repo Strategy

### Option A: Monorepo (Recommended)

```
kmd-monorepo/
  packages/
    core/        ← @kmdr/core
    react/       ← @kmdr/react
    web/         ← @kmdr/web
    styles/      ← @kmdr/styles
    worker/      ← @kmdr/worker
  apps/
    desktop/     ← kmd (Tauri desktop)
    ios/         ← kmd-ios (Tauri iOS)
  tools/
    tsup.config.ts
    tsconfig.base.json
  package.json   ← workspace root
```

**Pros:**
- Atomic changes across core + apps
- Single PR can update parser + desktop + iOS
- Shared dev tooling
- No version lag between packages
- pnpm/npm workspaces handle local linking

**Cons:**
- Bigger repo, more complex CI
- Unity port stays separate anyway (different language)

### Option B: Polyrepo with npm packages

```
kmd-core      (npm: @kmdr/core)    ← separate repo
kmd-react     (npm: @kmdr/react)  ← separate repo, depends on @kmdr/core
kmd-web       (npm: @kmdr/web)    ← separate repo, depends on @kmdr/core
kmd           (app)               ← existing repo, depends on @kmdr/core + @kmdr/react
kmd-ios       (app)               ← existing repo, depends on @kmdr/core + @kmdr/react
kmd-unity     (port)              ← existing repo, separate
```

**Pros:**
- Each package has its own release cadence
- Simpler CI per repo
- Clear ownership boundaries

**Cons:**
- Version coordination overhead
- Changes that span core + react need 2 PRs + 2 releases
- More boilerplate

### Recommendation: Monorepo (Option A)

Given:
- kmd and kmd-ios already share ~90% of their frontend code
- Features need to propagate to multiple platforms atomically
- Team is small (Anton + agents)
- pnpm workspaces + changesets handle versioning well

**Migration path:**
1. Create `kmd-core` monorepo (or rename existing kmd repo)
2. Extract `src/parser/` → `packages/core/src/`
3. Extract `src/reader/DocumentShell.tsx` + refactor `Reader.tsx` → `packages/react/src/`
4. Extract CSS → `packages/styles/`
5. kmd desktop app → `apps/desktop/` (or keep as separate repo depending on preference)
6. kmd-ios → `apps/ios/` (or keep separate, depends on @kmdr/* via npm)

**Lighter alternative:** Keep kmd and kmd-ios as separate repos, create a new `kmd-core` repo that publishes `@kmdr/core`, `@kmdr/react`, `@kmdr/web` as npm packages. kmd and kmd-ios depend on them via npm. This avoids the monorepo migration but requires version coordination.

---

## 8. Lightweight & Performant Design

### Bundle size targets

| Package | Target | Strategy |
|---------|--------|----------|
| `@kmdr/core` | <30KB min+gzip | Tree-shakeable ESM, Shiki/Mermaid/KaTeX are lazy-loaded |
| `@kmdr/react` | <10KB min+gzip | Peer-dep React, no runtime CSS-in-JS |
| `@kmdr/web` | <15KB min+gzip | Web Component, no React dep |
| `@kmdr/styles` | <8KB | Raw CSS, no build step |

### Key strategies

1. **Lazy-load heavy deps.** Shiki, Mermaid, KaTeX are already dynamically imported in kmd. The library should preserve this — core pipeline is just `unified` + `remark-*` + `rehype-*` (~15KB gzip).

2. **Tree-shakeable exports.** Users who only want `parseMarkdown()` don't pay for React components or Web Component definitions. Achieved via subpath exports + `sideEffects: false`.

3. **No CSS-in-JS.** Raw CSS files imported via subpath. Users can override CSS custom properties. Zero runtime CSS overhead.

4. **Optional Worker.** `@kmdr/worker` is a separate subpath — users who don't need off-main-thread parsing skip it entirely.

5. **No polyfills.** Target evergreen browsers. `unified` ecosystem already works in browsers.

6. **Single dependency tree.** The core depends on: `unified`, `remark-parse`, `remark-gfm`, `remark-math`, `remark-github-alerts`, `remark-rehype`, `rehype-raw`, `rehype-sanitize`, `rehype-stringify`, `rehype-slug`, `unist-util-visit`. All are small, composable, and tree-shakeable.

### Install & use simplicity

```bash
# React users
npm install kmd-web

# Vanilla JS users (no React needed)
npm install kmd-web
# import from 'kmd-web/web' instead of 'kmd-web/react'

# CDN (no install)
<script type="module" src="https://esm.sh/kmd-web/web"></script>
```

---

## 9. Migration Plan (kmd → kmd-web)

### Phase 1: Extract core (non-breaking)

1. Create `kmd-web` repo (or monorepo `packages/core`)
2. Copy `src/parser/` → `packages/core/src/` (no changes needed — already pure TS)
3. Copy `src/reader/linkPolicy.ts`, `domMorph.ts`, `anchorNavigation.ts`, `codeBlockEnhancements.ts` → `packages/core/src/`
4. Define `KmdAdapter` interface in `packages/core/src/adapter/types.ts`
5. Set up tsup build, publish as `kmd-web` (or `@kmdr/core`)
6. Add `kmd-web` as dependency in kmd's `package.json`, replace local imports

### Phase 2: Extract React components

1. Refactor `Reader.tsx` → `MarkdownReader.tsx`:
   - Replace `isTauriRuntime()` + dynamic Tauri imports with adapter calls
   - Replace `useToast()` with optional callback prop
   - Replace `resolveRelativeImages()` with `adapter.resolveImage()`
2. Copy `DocumentShell.tsx` → `packages/react/src/` (no changes needed)
3. Copy CSS → `packages/styles/`
4. Publish `kmd-web/react` subpath
5. kmd desktop imports from `kmd-web/react` instead of local `src/reader/`

### Phase 3: Web Component

1. Create `packages/web/src/KmdReaderElement.ts`
2. Wraps `@kmdr/core` `parseMarkdown()` + renders HTML into shadow DOM
3. Exposes `content` attribute/property, `kmd:link-click` events
4. Publish `kmd-web/web` subpath

### Phase 4: Unify kmd-ios

1. Update kmd-ios `package.json` to depend on `kmd-web` (or `@kmdr/core` + `@kmdr/react`)
2. Replace forked `src/parser/` with imports from `kmd-web`
3. Replace forked `src/reader/` with imports from `kmd-web/react`
4. Keep iOS-specific: StoreKit, security tests, entitlements, iOS bridge
5. This eliminates the fork — kmd-ios becomes a thin app shell around the shared library

### Phase 5: kmd-unity alignment

1. kmd-unity stays C# (Markdig + UIToolkit) — no code sharing possible
2. Share the `DesignDocument` IR type spec (as a schema/JSON file)
3. Share the design mode detection rules (document them, port to C#)
4. Feature parity tracked via a shared checklist, not code

---

## 10. Naming

- **npm package:** `kmd-web` (single package) or `@kmdr/core`, `@kmdr/react`, `@kmdr/web` (scoped)
- **npm scope:** `@kmdr` (short for "kmd reader", matches Unity package name `com.kmdr.markdownviewer`)
- **Web Component:** `<kmd-reader>`
- **React component:** `<MarkdownReader>` (or `<KmdReader>`)

The `@kmdr` scope is clean, short, and already used in the Unity package name. If a single package is preferred, `kmd-web` is discoverable and clear.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| kmd-ios fork has diverged significantly | Phase 4 is the hardest — do it incrementally, not all at once |
| Worker bridge uses `new URL()` which is bundler-specific | Make worker optional; provide sync fallback (already exists in kmd) |
| Shiki/Mermaid/KaTeX are heavy | Already lazy-loaded; document that they're optional |
| CSS scoping in Web Component (Shadow DOM) | Use `::part()` for customization; ship unscoped CSS for React users |
| Breaking changes in core affect all platforms | Use semver strictly; changeset-based releases |
| Unity can't share code | Accept this — share spec, not code. Track parity via docs |

---

## 12. Summary Recommendation

1. **Create a `kmd-web` package** (single npm package with subpath exports, or `@kmdr/*` scoped packages)
2. **Extract `src/parser/` as the core** — it's already pure TypeScript, zero refactoring
3. **Refactor `Reader.tsx` to use an adapter interface** — replace `isTauriRuntime()` checks with injectable adapters
4. **Ship 3 entry points:** `kmd-web` (core), `kmd-web/react` (React), `kmd-web/web` (Web Component)
5. **CSS as raw files** via `kmd-web/styles/*` subpath — no CSS-in-JS, no runtime overhead
6. **Use tsup for dual ESM/CJS builds** with TypeScript declarations
7. **kmd and kmd-ios depend on kmd-web** via npm — eliminates the fork
8. **kmd-unity stays separate** (C#), shares the design spec / IR types
9. **Future features** land in `@kmdr/core` or `@kmdr/react`, propagate to all JS platforms via npm update
10. **Monorepo preferred** if willing to migrate — atomic cross-package changes, single CI, shared tooling
