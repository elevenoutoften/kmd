# kmd Ecosystem North Star

Status: living document. Owner: kmd maintainers. Created: 2026-07-22.

Companions: [kmd-web implementation plan](18-kmd-web-implementation-plan.md),
[product vision](02-product-vision.md), [rendering architecture](06-rendering-architecture.md),
[cross-platform architecture](07-cross-platform-technical-architecture.md), and
[security and privacy](09-security-privacy.md).

Flow is the source of truth for implementation status. This document is the
source of truth for the destination, boundaries, and architectural decisions.
Update it when those decisions change; do not turn it into a task checklist.

## North star

`kmd` becomes a family of reader products built around one canonical web
rendering engine and one observable compatibility contract.

A Markdown document should look, behave, and remain safe in the same way when
it is opened in the desktop app, the private iOS app, a website using
`kmd-web`, or—within the limits of its native UI toolkit—the Unity editor port.
New Markdown features should normally be implemented once for JavaScript hosts,
described once in shared contracts and fixtures, and then consumed by each
product through a small platform adapter.

The family remains reader-first: beautiful, calm, local-first, secure, fast,
and useful without configuration. Web reuse must not turn the desktop app into
a generic browser widget or make lightweight consumers download editor,
Mermaid, math, highlighting, design-mode, or font code they did not request.

## Desired end state

```text
                         kmd ecosystem contract
                 fixtures + schemas + tokens + policies
                                  |
            +---------------------+---------------------+
            |                                           |
       kmd-web repository                         kmd-unity repository
  canonical JavaScript implementation           native C#/UIToolkit port
            |                                   consumes the same contract
     +------+-------+
     |              |
 kmd desktop     kmd-ios private       websites and other applications
 Tauri adapter   iOS/Tauri adapter     React, Web Component, or core API
```

The repositories have deliberately different responsibilities:

| Repository | Visibility | Owns | Must not own |
|---|---|---|---|
| `kmd-web` | Public | Canonical JavaScript parser, sanitizer, browser runtime, React API, Web Component, styles, optional web features, contracts, fixtures, package releases | Native file access, StoreKit, Tauri window lifecycle, app-specific settings |
| `kmd` | Public | Windows/macOS Tauri shell, Rust path and file policy, desktop file lifecycle, recent files, export and desktop release UX | A private copy of the canonical TypeScript renderer |
| `kmd-ios` | Private | iOS shell, Files/security-scoped access, Swift bridges, StoreKit, signing, TestFlight and App Store configuration | A forked copy of shared parsing, sanitization, reader UI, or fixtures |
| `kmd-unity` | Public | Native Markdig + UIToolkit implementation, Unity editor integration, Unity packaging | JavaScript runtime embedding or claims of unsupported feature parity |

The ecosystem is therefore polyrepo at the product level and monorepo inside
`kmd-web`. The private iOS boundary is preserved without sacrificing a shared
renderer.

## Product and package naming

- The product family is always `kmd`, lowercase.
- The public web repository and convenience npm package are `kmd-web`.
- The unrelated npm package named `kmd` is not part of this project.
- Public imports use explicit, stable entry points rather than internal files.
- If separate packages become necessary, they live under an npm organization
  controlled by the project. Do not invent a scope before ownership is set up.

The intended simple installation remains:

```bash
npm install kmd-web
```

```tsx
import { MarkdownReader } from "kmd-web/react";
import "kmd-web/styles.css";
```

Advanced consumers can import only the engine or browser surface they need.

## `kmd-web` repository shape

The repository uses workspaces so package boundaries are enforced during
development even if the initial release presents one convenience package.

```text
kmd-web/
  packages/
    contracts/       Versioned schemas, fixtures, expected results, feature matrix
    core/            Markdown -> safe RenderResult; no DOM, React, Tauri, or Node I/O
    browser/         DOM enhancement, worker bridge, cache, asset URL lifecycle
    styles/          Scoped reader CSS and generated design tokens
    react/           <MarkdownReader>, <DocumentShell>, React hooks
    element/         Optional <kmd-reader> custom element
    design/          Optional DESIGN.md extraction and presentation
    highlighting/    Optional Shiki integration
    mermaid/         Optional Mermaid integration
    math/            Optional KaTeX integration
    kmd-web/         Convenience exports for the supported public entry points
  examples/
    vanilla/
    react/
    integration/
  tooling/
  docs/
```

This is a target shape, not permission to publish every package on day one.
Start with the boundaries required to prevent coupling. Publish separately only
when bundle size, dependency isolation, or independent versioning justifies it.

## Layer contracts

### Contracts

The contract package describes observable behavior, not a specific parser
library. It contains:

- Markdown and malicious-input fixtures.
- Expected safe HTML or normalized observations.
- Outline, slug, diagnostics, URL, image and feature-detection results.
- Theme token schema and generated-output snapshots.
- A versioned feature matrix with `full`, `fallback`, `planned`, `unsupported`,
  and `not-applicable` states.

Unity consumes this contract even though it cannot consume JavaScript.

### Core

Core accepts source text and explicit render options, and returns a stable,
serializable result:

```ts
interface RenderResult {
  html: string;
  outline: OutlineEntry[];
  diagnostics: Diagnostic[];
  assets: AssetReference[];
  metadata: DocumentMetadata;
  detectedFeatures: DetectedFeatures;
  rendererVersion: string;
}
```

Core owns Markdown semantics, sanitization, safe URL classification, structural
transforms and feature detection. It does not open files, mutate the DOM, open
links, copy text, create workers, fetch resources, or assume a Tauri runtime.

The unified/HAST stack remains an internal implementation detail until a real
consumer requires a public AST. Do not block extraction on designing a complete
private AST.

### Browser runtime

The browser layer owns effects that need web APIs:

- Progressive enhancement of rendered HTML.
- Worker creation and fallback.
- Scroll and anchor behavior.
- Copy controls.
- Object/blob URL creation and revocation.
- Lazy rendering coordination.
- Browser-safe caching.

It consumes capabilities supplied by a host instead of detecting Tauri.

### Host capabilities

Prefer narrow capabilities over one growing `KmdAdapter` object:

```ts
interface AssetResolver {
  resolveAsset(request: AssetRequest): Promise<ResolvedAsset>;
}

interface LinkHandler {
  openExternal(url: URL): Promise<void>;
  openDocument(target: DocumentTarget): Promise<void>;
}

interface ClipboardProvider {
  writeText(value: string): Promise<void>;
}
```

The core security policy decides whether an action is allowed. A host capability
only carries out an already-classified action. Adapters must not become a way to
bypass URL, asset, or path policy.

### React and Web Component surfaces

React is the first supported UI binding because desktop and iOS already use it.
React and ReactDOM are peer dependencies. The React package must not own native
file access.

The Web Component follows the stable browser API; it does not define a second
rendering system. It supports properties for structured values, attributes for
simple declarative values, DOM events for host actions, and a documented CSS
custom-property surface.

## Features and extension policy

The default reader includes CommonMark/GFM, alerts, safe raw-HTML handling,
outline generation, tables, task lists, footnotes, code fences, scoped styles,
and accessible interaction.

Heavy or specialized features are explicit and lazy:

- Shiki highlighting.
- Mermaid rendering.
- KaTeX math.
- DESIGN.md parsing and visualization.
- Future editor mode.
- Optional bundled fonts.

Feature detection must not load the implementation. A document without Mermaid
must not download Mermaid. Failure in a heavy feature must produce a readable
fallback, never a blank document.

Editor mode is a separate future package or application feature. It may consume
the reader but must not make reader-only consumers download an editor engine.

Fonts are similarly optional. The baseline uses a high-quality system stack.
Font manifests, licenses and optional assets may be distributed separately;
Markdown cannot supply arbitrary font URLs.

## Security invariants

All existing security requirements remain binding across hosts:

- Markdown is untrusted, including local Markdown.
- Sanitize after parsing and transforms.
- Raw HTML uses a strict allowlist.
- Block dangerous and unknown URL schemes by default.
- Remote images are blocked by default or require explicit host/user action.
- Local relative assets are resolved only through a host capability constrained
  to an allowed document root.
- External links leave the reader through a validated host action.
- Mermaid, math and SVG cannot fetch arbitrary external resources.
- Heavy rendering has timeouts, limits and readable fallbacks.
- Rendered content cannot invoke Tauri or privileged host APIs directly.
- Safe defaults are not weakened for installation convenience.

Every security-policy change requires malicious fixtures in `contracts` and
tests in each affected implementation.

## Performance and size invariants

Performance claims are measured from published artifacts, not estimated from
source dependencies.

- The initial reader bundle excludes Mermaid, KaTeX, Shiki grammars, DESIGN.md
  UI, editor code and font binaries.
- CSS is static and scoped; no CSS-in-JS runtime is required.
- React is not bundled into the React package.
- Small documents render without mandatory worker startup.
- Medium/large documents can use a worker and progressive heavy-feature passes.
- Every package release records minified and gzip size changes.
- Benchmark fixtures cover small, 1 MB, code-heavy, diagram-heavy,
  design-heavy and pathological documents.
- Regressions above an agreed budget fail CI or require an explicit recorded
  exception.

Initial budgets are established by the first extracted build. Until then,
numbers such as “30 KB core” are goals to investigate, not contracts.

## Versioning and release model

- `kmd-web` starts at `0.x` with ESM-first packages and explicit exports.
- Workspace packages use lockstep versions initially.
- Prereleases are validated by desktop before promotion to stable.
- Every release includes changelog, provenance, package contents check, size
  report, test report and migration notes for breaking changes.
- Desktop and iOS pin a compatible released version; automated pull requests
  propose upgrades.
- Unity records the contracts version it implements.
- Core behavior, sanitization and public types follow semantic versioning.
- Internal module paths are never public API.

## How a feature reaches every product

1. Define the behavior and platform expectations in an issue or Flow task.
2. Add or update shared contract fixtures.
3. Implement the JavaScript behavior in the narrowest `kmd-web` package.
4. Verify browser, React, security, accessibility, size and performance gates.
5. Release a prerelease and update desktop as the first integration consumer.
6. Update private iOS through the same package release.
7. Classify Unity support; implement native parity or document a deliberate
   fallback/unsupported state.
8. Promote the package release after downstream evidence is recorded.

Platform-only behavior—file pickers, recent files, StoreKit, signing, OS window
management—stays in its product repository and does not enter `kmd-web`.

## Governance and sources of truth

| Concern | Source of truth |
|---|---|
| Destination and boundaries | This North Star |
| Phases, gates and task design | `18-kmd-web-implementation-plan.md` |
| Live status, assignment and dependencies | Flow project `kmd-web` |
| Current public API | Export maps, generated API docs and package tests |
| Markdown compatibility | Versioned contracts and fixtures |
| Security | Security specification plus malicious fixtures |
| Visual language | Canonical token source plus generated CSS/USS |
| Released behavior | Package changelog and compatibility matrix |

Implementing agents must read the target repository's `AGENTS.md`, this North
Star, the implementation plan, the full Flow task and all dependency handoffs.
They work on one task at a time, keep changes scoped, run the stated verification,
and do not mark a task complete while any acceptance criterion is unmet.

## Success measures

The architecture is succeeding when:

- Desktop and iOS no longer carry copied parser/reader implementations.
- A normal parser, sanitizer or reader fix lands once and reaches both apps via
  a package update.
- A website can install and render kmd safely with a minimal API in minutes.
- Baseline consumers do not download unrequested heavy features.
- Unity runs the shared conformance fixtures and reports its parity honestly.
- Security fixtures pass across every applicable host.
- Release size and benchmark data are visible and stable.
- Adding a new feature has an obvious owner, package, fixture path and downstream
  propagation process.

## Explicit non-goals

- Combining public desktop and private iOS source into one repository.
- Rewriting the Unity port in JavaScript or embedding an unsupported WebView.
- Publishing an unstable internal AST merely for architectural purity.
- Building a general plugin marketplace or executing document-supplied code.
- Shipping editor, fonts, Mermaid, math or all highlighting grammars in the
  baseline reader bundle.
- Making web extraction block ongoing desktop quality work longer than necessary.

## Decision triggers

Revisit this architecture only with measured evidence:

- Split a package when dependency isolation, install size, ownership or release
  cadence requires it.
- Add CommonJS only when a supported consumer cannot use ESM.
- Expose an AST only when at least one external integration needs it and the
  compatibility cost is understood.
- Introduce virtualization only after large-document benchmarks show the simpler
  progressive strategy is insufficient.
- Change parser libraries only behind the stable contract and fixture suite.
- Add a bundled font package only with licenses, measured value and opt-in loading.

## Long-term horizon

Once the shared reader is stable, the ecosystem can grow without changing its
foundation:

- Reader presets and custom themes.
- Optional source/split editor package.
- Server-side/pre-rendered HTML entry point.
- Framework bindings beyond React when demanded.
- Accessible presentation mode.
- Export tooling.
- More design-document analysis.
- Embeddable documentation portals and agent-generated project reports.

These are downstream products of a stable, safe reader engine. They are not
reasons to delay the extraction or enlarge the initial package.
