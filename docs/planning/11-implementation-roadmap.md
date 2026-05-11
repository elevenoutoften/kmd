# Implementation Roadmap

This roadmap is for app implementation after the repository docs are prepared. Do not start app code until `AGENTS.md`, `README.md`, `DESIGN.md`, `CONTRIBUTING.md`, and `SECURITY.md` exist and the relevant issue or request is understood.

## Milestone 0 - Project skeleton

Goal: kmd opens on Windows and macOS with a static sample document.

Tasks:

- Create Tauri 2 project.
- Add React + TypeScript + Vite.
- Add basic app shell.
- Implement local sample document route.
- Add app theme variables.
- Set up desktop CI builds where possible.

Exit criteria:

- App launches.
- Static sample Markdown-like page is visible.
- Light/dark theme toggle works.

## Milestone 1 - File open and basic rendering

Goal: open a local `.md` file and render CommonMark/GFM.

Tasks:

- Rust `open_document` command.
- Desktop file picker.
- Add parser pipeline with `remark-parse` and `remark-gfm`.
- Render headings, paragraphs, lists, links, images, blockquotes, code, tables, task lists.
- Implement relative local image loading through backend.
- Add outline from headings.

Exit criteria:

- User can open a README.
- Heading outline works.
- Tables and code blocks are readable.

## Milestone 2 - Beautiful reader UI

Goal: make normal Markdown feel premium.

Tasks:

- Reader CSS system.
- Light/dark/sepia themes.
- Text size and line width settings.
- Code block component with copy button.
- Responsive table shell.
- Image lightbox.
- Link handling through native browser.
- Recent files.

Exit criteria:

- Same document looks good on Windows and macOS.
- Narrow desktop windows remain usable.
- No raw browser-default Markdown styling remains.

## Milestone 3 - GitHub extras

Goal: support expected GitHub-style extras.

Tasks:

- GitHub alerts transformer.
- Shiki syntax highlighting.
- Footnotes styling.
- Front matter metadata panel.
- Mermaid rendering setting.
- Math rendering setting.
- GitHub theme mode.

Exit criteria:

- Showcase document renders all major blocks.
- Mermaid errors are graceful.
- Math and code highlighting do not block first render.

## Milestone 4 - Security hardening

Goal: safe handling of untrusted Markdown.

Tasks:

- Add strict URL policy.
- Add sanitizer.
- Add raw HTML setting.
- Add CSP.
- Add XSS fixtures.
- Add path traversal tests.
- Remote image blocking.
- SVG policy.

Exit criteria:

- XSS fixture suite passes.
- No document content can call privileged Tauri commands.
- Unsafe links do not open.

## Milestone 5 - DESIGN.md v1

Goal: first-class `DESIGN.md` rendering.

Tasks:

- Detection.
- YAML token parser.
- Token reference resolver.
- Design Mode layout.
- Color gallery.
- Typography specimens.
- Spacing/radius galleries.
- Component token cards.
- Lint panel.
- Contrast checks.
- Apply tokens as theme preview.

Exit criteria:

- Official-style `DESIGN.md` examples render as design system pages.
- Broken references and contrast issues are visible.
- User can copy token values.

## Milestone 6 - Export and polish

Goal: make kmd genuinely useful in daily workflows.

Tasks:

- Export HTML.
- Export PDF.
- Print stylesheet.
- Folder mode.
- In-document search.
- Settings persistence.
- File association.
- App icons.
- Release packaging.

Exit criteria:

- kmd is usable as a default Markdown viewer.
- Designers can inspect `DESIGN.md`.
- Developers can read READMEs/specs comfortably.

## Milestone 7 - Optional editor and pro features

Tasks:

- Source mode.
- Split preview.
- Minimal editing.
- Markdown lint hints.
- Custom themes.
- `DESIGN.md` diff.
- Official CLI integration.
- GitHub repository context plugin.
- iOS support pass.
