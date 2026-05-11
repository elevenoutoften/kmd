# Design Mode Accessibility Audit

## Scope

This audit covers the DESIGN.md mode tab shell, preview sections, source view,
token table, lint diagnostics, and compare tab.

## Findings and Fixes

- Tabs now follow the ARIA tabs pattern with `tablist`, `tab`, `tabpanel`,
  `aria-selected`, and matching `aria-controls` / `aria-labelledby` values.
- Tab panel changes are announced through a polite live region.
- Clipboard feedback for token, color, typography, spacing, radius, elevation,
  surface, and component copy actions remains in polite live regions.
- Keyboard focus is visible across design tab panels, including buttons, links,
  inputs, summaries, tab controls, and keyboard-operable token cards.
- Color previews expose accessible swatch labels with token name, value, role,
  and contrast ratio information instead of relying on color alone.
- Lint diagnostics include severity text and icon prefixes, so severity is not
  communicated only through color.
- Interactive diagnostic rows, swatches, radius cards, spacing rows, elevation
  cards, and surface cards are keyboard-operable.
- Reduced-motion users receive near-zero transition and animation durations for
  design mode effects, source line highlighting, lint row hover states, swatch
  transitions, and widget hover effects.
- Large token tables use viewport windowing once the filtered token count is
  greater than 200, preserving keyboard-reachable copy buttons without mounting
  every row.
