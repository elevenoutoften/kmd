# Security

kmd is local-first, but local Markdown is still untrusted input.

## Threat model

Markdown may contain raw HTML, dangerous URLs, remote images, SVG content, Mermaid diagrams, math, and huge pathological input. Rendering happens in a WebView, so the app must treat every document as hostile until sanitized and policy-checked.

## Required policies

- Raw HTML is disabled or sanitized through a strict allowlist.
- External links open through a native bridge only after URL validation.
- `javascript:`, `vbscript:`, unsafe `data:`, unknown custom schemes, and arbitrary `file:` URLs are blocked.
- Relative local assets are resolved by the Rust backend against the opened document or granted folder.
- Remote images are blocked by default or loaded only after explicit user action.
- SVG is treated as risky and must not execute scripts or load external resources.
- Mermaid and math rendering must not fetch external resources and must have graceful error states.
- Rendered document content must not be able to call privileged Tauri commands directly.

## WebView boundary

The app shell may use Tauri APIs. Rendered Markdown must live inside a controlled article surface with delegated event handlers for links, images, copy actions, and outline navigation.

If iframe isolation is added later, communication must use `postMessage` with strict source and message validation.

## Dependency hygiene

- Pin parser, sanitizer, Mermaid, KaTeX, Shiki, and Tauri dependencies.
- Keep security fixtures for XSS, URL policy, path traversal, remote images, and SVG handling.
- Treat sanitizer upgrades as release-critical changes.

## Reporting

Please report vulnerabilities through GitHub private vulnerability reporting when available. If that is not available, open a minimal issue that avoids exploit details and ask for a private contact path.

Do not post working exploit payloads, private file paths, signing keys, or user document contents in public issues.
