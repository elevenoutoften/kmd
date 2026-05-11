# DESIGN.md Support

## What DESIGN.md is

`DESIGN.md` is a plain-text design-system format from Google Labs/Stitch.

It combines:

1. **YAML front matter** for design tokens.
2. **Markdown prose** for design rationale and usage guidance.

The token values are normative. The prose explains intent and usage.

## Why it matters for this app

This app should become the best place to read and inspect `DESIGN.md` files.

Most Markdown readers will show the file as normal Markdown. This app can go further:

- visual token galleries
- typography specimens
- spacing and radius scales
- component token cards
- contrast warnings
- broken token reference warnings
- one-click export to CSS variables / JSON
- live preview theme based on the file's own tokens

## Detection

Enter Design Mode when one or more is true:

1. File basename is exactly `DESIGN.md`.
2. YAML front matter contains at least `name` plus one of `colors`, `typography`, `spacing`, `rounded`, or `components`.
3. User manually selects `View as DESIGN.md`.

## Supported schema v1

```yaml
version: alpha
name: <string>
description: <string>
colors:
  <token-name>: "#RRGGBB"
typography:
  <token-name>:
    fontFamily: <string>
    fontSize: <dimension>
    fontWeight: <number|string>
    lineHeight: <dimension|number>
    letterSpacing: <dimension>
    fontFeature: <string>
    fontVariation: <string>
rounded:
  <scale-level>: <dimension>
spacing:
  <scale-level>: <dimension|number>
components:
  <component-name>:
    backgroundColor: <color|token-ref>
    textColor: <color|token-ref>
    typography: <typography|token-ref>
    rounded: <dimension|token-ref>
    padding: <dimension|token-ref>
    size: <dimension|token-ref>
    height: <dimension|token-ref>
    width: <dimension|token-ref>
```

## Token references

Reference syntax:

```yaml
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
```

Rules:

- Resolve references after parsing front matter.
- Preserve original reference string for display.
- Detect unresolved references.
- Detect circular references.
- For component values, references may point to composite typography objects.

## Canonical sections

The spec recommends this order:

1. Overview / Brand & Style
2. Colors
3. Typography
4. Layout / Layout & Spacing
5. Elevation & Depth / Elevation
6. Shapes
7. Components
8. Do's and Don'ts

App behavior:

- Show section order warnings, not hard errors.
- Preserve unknown sections.
- Detect duplicate canonical sections as errors.
- Unknown sections appear under "Additional Guidance".

## Design Mode UI

### Top summary card

Shows:

- design system name
- description
- spec version
- number of colors
- number of typography tokens
- number of spacing tokens
- number of component tokens
- lint result count

### Token tabs

Tabs:

- Overview
- Colors
- Typography
- Spacing
- Radius
- Components
- Guidance
- Lint

### Colors tab

For each color token:

- swatch
- token name
- hex value
- copy buttons
- contrast suggestions against likely text/surface tokens
- usage snippets

### Typography tab

For each typography token:

- specimen text
- token properties
- CSS preview
- copy CSS variable

### Spacing tab

For each spacing token:

- visual ruler
- token name
- value

### Radius tab

For each rounded token:

- visual rounded rectangle
- value

### Components tab

For each component token group:

- miniature component preview where possible
- resolved values
- unresolved references highlighted
- accessibility warnings

### Lint tab

Findings:

- error
- warning
- info

Rules to implement initially:

| Rule | Severity | Description |
|---|---|---|
| `broken-ref` | error | Token reference points nowhere |
| `circular-ref` | error | Reference chain loops |
| `duplicate-section` | error | Duplicate canonical section |
| `invalid-color` | error | Color not valid sRGB hex |
| `invalid-dimension` | warning | Dimension not px/em/rem or accepted number |
| `missing-primary` | warning | Colors exist but no primary token |
| `missing-typography` | warning | Colors exist but typography missing |
| `contrast-ratio` | warning | Component text/background below WCAG AA |
| `orphaned-tokens` | info | Tokens defined but not referenced |
| `section-order` | info | Canonical sections are out of order |
| `unknown-component-property` | info | Preserve but warn |

## Live theme preview

The app should be able to apply a `DESIGN.md` file as a reader theme.

Mapping:

```text
colors.primary        -> --mdr-text-primary or accent depending on role
colors.secondary      -> --mdr-text-secondary
colors.neutral        -> --mdr-bg
colors.surface        -> --mdr-surface
colors.tertiary       -> --mdr-accent
typography.body-md    -> document body
typography.h1/h2/etc  -> headings when names match
spacing.md            -> block gap
rounded.md            -> cards/code/callouts
```

Because DESIGN.md token names are flexible, use heuristics but always let users override mapping.

## Export

P1:

- Export parsed token JSON.
- Export CSS variables.
- Copy token reference path.

P2:

- Export Tailwind v4 `@theme` CSS.
- Export DTCG tokens JSON.
- Run official `@google/design.md export` if Node is available.

## CLI integration

Do not require Node for core app features.

But if Node is installed, optionally use:

```bash
npx @google/design.md lint DESIGN.md
npx @google/design.md diff DESIGN.md DESIGN-v2.md
npx @google/design.md export --format dtcg DESIGN.md
```

Recommended app behavior:

- Native internal parser/linter for immediate UX.
- Optional official CLI validation for "Compare with official tool" action.

## Alpha-spec handling

Google marks the format as alpha, so the app must be future-tolerant:

- Preserve unknown tokens and sections.
- Do not destroy or auto-rewrite files.
- Version adapters internally: `designmd-alpha-adapter-v1`.
- Warn users that validation follows the app's known schema version.
