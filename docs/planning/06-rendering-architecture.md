# Rendering Architecture

## Goals

- Beautiful output.
- GitHub-compatible baseline.
- Safe local rendering.
- Cross-platform consistency.
- Extensible enough for DESIGN.md, Mermaid, math, callouts, and future dialects.
- No network dependency for normal reading.

## Recommended pipeline

```text
FileLoader
  -> EncodingDetector
  -> FrontMatterExtractor
  -> MarkdownParser
  -> AST Normalizer
  -> Extension Transformers
  -> Security Sanitizer
  -> Semantic Renderer
  -> Theme Resolver
  -> WebView Presentation
```

## FileLoader

Responsibilities:

- Read local file through Tauri/Rust.
- Resolve security-scoped iOS file URLs.
- Resolve relative asset URLs.
- Watch desktop files for changes.
- Cache file metadata.

## EncodingDetector

Priority:

1. UTF-8
2. UTF-8 with BOM
3. UTF-16 LE/BE if BOM exists
4. System fallback with warning

## FrontMatterExtractor

Extract only if document starts with a supported fence:

```md
---
yaml
---
```

Optional later:

```md
+++
toml
+++
```

Return:

```ts
type FrontMatterResult = {
  raw: string | null
  format: "yaml" | "toml" | "json" | null
  data: unknown | null
  body: string
  errors: Diagnostic[]
}
```

## MarkdownParser options

### Recommended web stack

Use unified ecosystem:

```text
micromark / remark-parse
remark-gfm
remark-frontmatter
remark-math
custom remark-github-alerts
remark-rehype
rehype-katex
rehype-sanitize
custom rehype components
```

For code highlighting:

- Shiki at build/runtime.
- Cache highlighted HTML per content hash and language.
- Fall back to plain text if grammar missing.

For Mermaid:

- Detect `code` node with language `mermaid`.
- Replace with `MermaidBlock`.
- Render in sandboxed container.

### Compatibility oracle

Keep `cmark-gfm` as a test oracle for core GFM fixtures.

Do not let visual customizations change parsing semantics unnoticed.

## AST normal form

Define an app-internal normalized AST independent of library details.

Example:

```ts
type Node =
  | DocumentNode
  | HeadingNode
  | ParagraphNode
  | TextNode
  | LinkNode
  | ImageNode
  | CodeBlockNode
  | InlineCodeNode
  | TableNode
  | TaskListItemNode
  | AlertNode
  | MermaidNode
  | MathNode
  | HtmlNode
  | DesignTokenGalleryNode
```

Benefits:

- Easier snapshot tests.
- Future parser swaps.
- Easier native rendering if needed later.

## Extension transformers

### GitHub alerts transformer

Input blockquote:

```md
> [!WARNING]
> Text
```

Output:

```ts
{
  type: "alert",
  kind: "warning",
  title: "Warning",
  children: [...]
}
```

### DESIGN.md transformer

Input:

- parsed YAML tokens
- Markdown body sections

Output injected before body:

```ts
{
  type: "designSummary",
  tokens: ...
}
{
  type: "designTokenGallery",
  section: "colors"
}
```

But preserve the original body after the generated panels.

### Mermaid transformer

Input:

```ts
CodeBlockNode(language: "mermaid")
```

Output:

```ts
MermaidNode(source, hash, renderPolicy)
```

### Code transformer

Enhance code blocks with:

- language label
- copy button
- wrap toggle
- highlighted spans
- optional line numbers

## Sanitization

Default:

- User Markdown is untrusted.
- Parsed HTML output is sanitized before injection.
- Raw HTML is either disabled or sanitized through a strict GitHub-like schema.

Important:

- Sanitize at the final HTML/DOM stage, not only before Markdown parsing.
- Block `javascript:`, `data:` URLs except safe image MIME data URLs if explicitly allowed.
- Add `rel="noopener noreferrer"` to external links.
- Open external URLs through safe OS browser bridge.

## Rendering

Use semantic HTML inside a scoped root:

```html
<article class="mdr-doc" data-theme="reader">
  ...
</article>
```

All CSS lives under `.mdr-doc`.

Avoid global CSS leak.

## Theme resolver

Theme inputs:

1. App base theme: light/dark/sepia.
2. User typography settings.
3. Optional document front matter.
4. Optional `DESIGN.md` token mapping.
5. Platform accessibility settings.

Output:

```css
:root {
  --mdr-bg: ...
  --mdr-text: ...
  --mdr-accent: ...
  --mdr-font-body: ...
}
```

## Layout primitives

Markdown blocks map to app components:

| Markdown | Component |
|---|---|
| `#` | Display heading with anchor |
| `##` | Section heading |
| paragraph | readable body text |
| blockquote | quote card |
| GitHub alert | semantic alert card |
| table | responsive table shell |
| code fence | code card |
| image | figure with zoom |
| footnote | linked notes |
| task list | read-only checkbox row |
| `DESIGN.md` tokens | token gallery |

## Large document strategy

For files under 1 MB:

- Parse and render synchronously with loading state.

For files 1-10 MB:

- Parse in worker.
- Show outline as soon as heading pre-pass completes.
- Lazy render heavy blocks such as code, diagrams, and images.

For files over 10 MB:

- Ask user before full render or use virtualized block rendering.
- Keep source mode available.

## Caching

Cache keys:

```text
file path + file modified time + renderer version + theme hash
```

Cache:

- parsed AST
- generated outline
- syntax-highlighted blocks
- Mermaid SVG
- image dimensions
- DESIGN.md lint result

## Error handling

Never show a blank document.

If parsing fails:

- show source fallback
- show diagnostics panel
- allow copy source
- allow "open as plain text"

## Accessibility

- Proper heading hierarchy.
- Keyboard navigation.
- Focus states.
- Sufficient contrast.
- Links distinguishable without color alone.
- Tables navigable horizontally with keyboard.
- Alerts have visible title text and ARIA labels.
- Respect reduced motion.
