# Performance and Offline Specification

## Performance goals

| Action | Target |
|---|---|
| Cold launch desktop | under 1.5s on modern hardware |
| Cold launch iOS | under 1.5s (later target) |
| Open small doc under 100KB | under 150ms to first render |
| Open 1MB doc | under 800ms to first meaningful render |
| Search in current doc | under 100ms after indexing |
| Theme switch | under 100ms without reparse |
| Outline generation | under 100ms for normal docs |

## Offline requirements

The app should fully work offline for:

- Markdown parsing
- code highlighting for bundled languages
- local images
- Mermaid rendering
- math rendering
- DESIGN.md parsing/linting
- themes

Optional network features:

- remote images
- opening external links
- checking updates

## Bundle size strategy

Do not bundle every possible syntax highlighter grammar initially.

P0 languages:

- plaintext
- bash/sh
- json
- yaml
- markdown
- javascript
- typescript
- jsx/tsx
- html
- css
- python
- swift
- rust
- c
- cpp
- csharp
- java
- go
- sql
- diff

Lazy-load additional Shiki grammars.

## Parse strategy

### Small docs

- Parse in main frontend thread if fast enough.
- Render immediately.

### Medium docs

- Parse in Web Worker.
- Show skeleton with title and outline.
- Lazy-highlight code blocks.

### Large docs

- Heading pre-pass first.
- Virtualize blocks.
- Defer Mermaid and math.
- Allow source mode.

## Caching

Cache by:

```text
sha256(content) + rendererVersion + pluginConfig + themeHash
```

Cache:

- front matter parse result
- AST
- outline
- syntax-highlighted code
- Mermaid SVG
- DESIGN.md lint results
- image dimensions

## Memory

Avoid storing too many copies:

- file content string
- parsed AST
- rendered HTML

Release old AST/HTML for inactive recent documents.

## Diagram rendering

Mermaid can be expensive.

Rules:

- Render diagrams lazily when near viewport.
- Cache by source hash.
- Timeout on large/invalid diagrams.
- Use "click to render" for very large diagrams.

## Code highlighting

Shiki can be expensive.

Rules:

- Highlight lazily.
- Cache by `(language, codeHash, theme)`.
- Fallback to plain code until highlighted.
- Never block initial document render on all code blocks.

## Images

Rules:

- Lazy load.
- Decode dimensions asynchronously.
- Downscale previews for very large images.
- Full image in lightbox only.

## File watching

Desktop:

- Debounce updates by 300-500ms.
- If file changes while user is reading, show small "File changed — reload" toast unless auto-reload enabled.

iOS:

- No continuous file watch expected.
- Refresh when app returns foreground or file is reopened.

## Benchmark fixtures

Create fixtures:

- `small-readme.md` ~20KB
- `large-spec.md` ~1MB
- `huge-generated.md` ~10MB
- `tables.md` with wide tables
- `code-heavy.md` with 100 code fences
- `diagrams.md` with 20 Mermaid diagrams
- `design-md-heavy.md` with 300 tokens
- `xss-fixtures.md` with malicious HTML/URLs
