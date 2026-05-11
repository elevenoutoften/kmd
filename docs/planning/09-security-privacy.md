# Security and Privacy Specification

## Security principle

Markdown files are local, but local does not mean trusted.

A `.md` file can contain raw HTML, links, images, SVG, Mermaid source, and text that may be rendered in a WebView. Treat it as untrusted content.

## Privacy principle

The app is local-first.

- No account required.
- No telemetry by default.
- No document upload.
- No external network calls for rendering unless the user clicks a link or enables a feature.
- Remote images can be blocked by default or loaded only after confirmation.

## Threat model

| Threat | Example | Mitigation |
|---|---|---|
| XSS through raw HTML | `<img onerror=...>` | disable/sanitize raw HTML |
| Dangerous URL schemes | `[x](javascript:alert(1))` | strict URL scheme allowlist |
| Remote tracking images | `![x](https://tracker/...)` | block remote images by default |
| Mermaid script risk | malicious diagram content | sandboxed rendering, no external resources |
| SVG scripts | local SVG with script | sanitize or render as image with safe mode |
| Path traversal | `![x](../../secret)` | resolve only under allowed base folder unless user grants |
| WebView bridge abuse | content calls Tauri commands | isolate renderer; never expose powerful commands to document DOM |
| Huge file denial | 100MB pathological Markdown | size checks, worker parsing, fallback source mode |
| Link spoofing | deceptive link text | show URL preview on hover/long press |

## Raw HTML policy

Default: **safe subset only**.

Allowed candidates:

- `br`
- `kbd`
- `sub`
- `sup`
- `mark`
- `abbr`
- `details`
- `summary`

Potentially allowed later:

- `table` if parsed from raw HTML and sanitized
- `div` only with no attributes, or disabled
- `span` only with no attributes, or disabled

Always blocked:

- `script`
- `iframe`
- `object`
- `embed`
- `link`
- `meta`
- `style`
- `form`
- `input`
- `button`
- event attributes like `onclick`
- `style` attributes unless strict CSS sanitizer exists
- `srcdoc`
- `javascript:` URLs
- unsafe `data:` URLs

## Link policy

Allowed schemes:

- `https:`
- `http:`
- `mailto:`
- `tel:`
- relative links
- local file links only after user confirmation

Blocked schemes:

- `javascript:`
- `vbscript:`
- unknown custom schemes unless allowlisted
- `file:` from rendered content unless user confirms

External link handling:

- Do not open inside the reader WebView.
- Send through native OS "open URL" after validation.
- Add `rel="noopener noreferrer"` in rendered HTML.

## Image policy

Local images:

- Resolve relative to Markdown file.
- Read through Rust backend, not arbitrary WebView file access.
- Create safe object/blob URL or data URL from backend response.

Remote images:

- Setting: "Load remote images" off by default.
- If off, show placeholder with domain and Load button.

SVG:

- Treat as risky.
- Prefer rendering SVG as sanitized image.
- Strip scripts and external references.
- Later: use a dedicated SVG sanitizer.

## Mermaid policy

Mermaid diagrams must be sandboxed.

Requirements:

- No external network.
- No arbitrary scripts.
- Config locked down.
- Render timeout.
- Error fallback.
- Optional "render diagrams" setting.

## Math policy

KaTeX preferred for static rendering.

- Disable unsafe macros.
- No network.
- Render timeout for pathological input.

## WebView bridge isolation

Never mount Tauri APIs directly into document HTML.

Recommended structure:

```text
App shell JS has Tauri bridge.
Rendered Markdown is inserted into isolated article container.
Article container cannot call backend.
All links/images/actions go through controlled event handlers.
```

For maximum isolation later:

- Render Markdown in sandboxed iframe.
- Communicate via postMessage with strict origin/source checks.

## Content Security Policy

Suggested CSP:

```text
default-src 'none';
img-src 'self' data: blob:;
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
script-src 'self';
connect-src 'none';
```

Design Mode may add a narrow web-font exception so typography tokens can resolve
through safe provider-backed fonts: `style-src` may include
`https://fonts.googleapis.com` and `font-src` may include
`https://fonts.gstatic.com`. Markdown must never supply arbitrary font URLs.

If Mermaid requires worker/blob script, explicitly scope it.

## File access

Rust backend enforces:

- file opened by user is allowed
- assets relative to opened file are allowed
- folder access only after folder picker grant
- iOS security-scoped bookmarks respected
- no arbitrary path reading from Markdown links

## Sanitization placement

Correct order:

```text
Markdown parse -> HTML/AST transform -> sanitize final HTML/DOM -> render
```

Do not sanitize Markdown text before parsing and assume that is enough.

## Updates and dependencies

Renderer libraries are security-critical.

Rules:

- Pin versions.
- Use dependabot/renovate.
- Maintain security tests for raw HTML and URL payloads.
- Keep parser and sanitizer updates in a release checklist.
