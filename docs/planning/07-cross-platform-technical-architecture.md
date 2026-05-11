# Cross-Platform Technical Architecture

## Recommended stack

```text
Tauri 2
  Rust backend
  TypeScript frontend
  WebView renderer
  Vite build system
  React UI
```

kmd is desktop-first for v1: Windows and macOS are the primary targets. iOS support should stay viable through the Tauri architecture, but it is not the first release gate.

Recommended frontend choice: **React + TypeScript** because the team needs the richest Markdown ecosystem, mature component availability, and good fit with Shiki, Mermaid, KaTeX, unified, and `DESIGN.md` visualization.

## Why Tauri 2

Tauri 2 targets desktop and mobile from one codebase. It uses system WebViews and Rust for native/backend logic.

For kmd, that is a good fit because:

- Markdown rendering wants HTML/CSS-level typography.
- Mermaid, math, syntax highlighting, tables, and token previews are already web-native strengths.
- The Rust side can own secure file access.
- The app stays more compact than Electron.
- Windows and macOS can share the same reader renderer, with iOS later.

## C++ decision

Do **not** build a C++ core for v1.

Use Rust for the native core because it is the native language of Tauri, simplifies IPC, reduces FFI/build complexity, and is strong for file, cache, security, and watcher responsibilities. If parser exactness or performance becomes a bottleneck later, evaluate `cmark-gfm`, `comrak`, or a C/C++ parser module behind the same normalized rendering contract.

## Platform shell

### Windows

- WebView2.
- Native file picker.
- Recent files.
- File association for `.md`.
- Jump list later.
- System accent color later.

### macOS

- WKWebView.
- Native file picker.
- File association for `.md`.
- Quick Look extension later.
- Share extension later.
- Native toolbar feel.

### iOS

- WKWebView.
- Files picker.
- Security-scoped bookmarks.
- Document browser mode.
- Share sheet import.
- iCloud Drive support via Files.
- iPad multiwindow later.

## Rust backend modules

```text
src-tauri/
  src/
    main.rs
    commands/
      open_file.rs
      read_asset.rs
      watch_file.rs
      recent_files.rs
      export.rs
    markdown/
      frontmatter.rs
      design_md.rs
      diagnostics.rs
    security/
      url_policy.rs
      path_policy.rs
    cache/
      db.rs
```

## Frontend modules

```text
src/
  app/
    App.tsx
    routes.ts
  reader/
    ReaderView.tsx
    MarkdownRenderer.tsx
    Outline.tsx
    CodeBlock.tsx
    TableBlock.tsx
    AlertBlock.tsx
    MermaidBlock.tsx
    MathBlock.tsx
    ImageBlock.tsx
  design-md/
    DesignMode.tsx
    TokenGallery.tsx
    TypographySpecimens.tsx
    ComponentTokenCards.tsx
    LintPanel.tsx
  parsing/
    parseMarkdown.ts
    plugins/
      githubAlerts.ts
      designMd.ts
      safeLinks.ts
  theme/
    themes.ts
    cssVariables.ts
    designMdThemeMapper.ts
  platform/
    tauriApi.ts
```

## IPC commands

### `open_document`

Input:

```ts
{ path?: string }
```

Output:

```ts
{
  id: string
  displayName: string
  pathLabel: string
  content: string
  baseDir: string
  modifiedAt: number
  encodingWarning?: string
}
```

### `read_document_asset`

Input:

```ts
{
  documentId: string
  relativePath: string
}
```

Output:

```ts
{
  mimeType: string
  bytesBase64: string
}
```

### `watch_document`

Desktop only.

Input:

```ts
{ documentId: string }
```

Output event:

```ts
{
  documentId: string
  modifiedAt: number
}
```

### `export_html`

Input:

```ts
{
  documentId: string
  renderedHtml: string
  assets: AssetManifest
}
```

### `export_pdf`

Can be P2 because WebView print-to-PDF differs by platform.

## Storage

Use SQLite or small JSON files.

Tables:

```sql
recent_files(id, path_label, bookmark, last_opened_at)
settings(key, value_json)
cache(key, value_blob, created_at, version)
```

Do not store file content unless user enables cache.

## Build targets

Desktop:

```bash
npm run tauri build
```

iOS later:

```bash
npm run tauri ios build
```

CI should build:

- Windows x64
- macOS universal if possible
- iOS simulator smoke build later

## Dependency posture

Keep renderer dependencies explicit and pinned.

Suggested packages:

```text
@tauri-apps/api
react
react-dom
vite
typescript
unified
remark-parse
remark-gfm
remark-frontmatter
remark-math
remark-rehype
rehype-katex
rehype-sanitize
rehype-stringify
shiki
mermaid
yaml
zod
lucide-react
```

Potentially avoid `gray-matter` if custom front matter extraction is small enough.

## Native Swift alternative

If Windows is delayed or if Apple polish matters more than one codebase, use:

- SwiftUI app for macOS/iOS
- `swift-markdown` for parsing
- `MarkdownUI` for native SwiftUI rendering
- Separate Windows app later

This is not recommended for v1 because it fragments the renderer.

## Long-term architecture

Keep these layers separate:

1. Parser
2. Normalized AST
3. Renderer components
4. Theme system
5. Platform file shell

This prevents kmd from becoming locked into one Markdown library.
