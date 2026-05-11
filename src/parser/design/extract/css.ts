/**
 * CSS custom-property extractor for the design pipeline.
 *
 * Scans fenced code blocks (` ```css `, ` ```scss `, ` ```tailwind `,
 * ` ```theme `) and any code block whose body contains `:root {` or `@theme {`.
 * Parses CSS custom property declarations (`--variable: value;`) and maps them
 * to typed IR tokens by namespace prefix.
 *
 * Namespace mapping:
 *   --color-*      → ColorToken
 *   --font-*       → TypographyToken (family)
 *   --text-*       → TypographyToken (size)
 *   --leading-*    → TypographyToken (lineHeight)
 *   --tracking-*   → TypographyToken (letterSpacing)
 *   --spacing-*    → SpacingToken
 *   --radius-*     → RadiusToken
 *   --rounded-*    → RadiusToken
 *   --shadow-*     → ElevationToken
 *   --elevation-*  → ElevationToken
 *   other          → spec.unknown
 */

import { fromMarkdown } from "mdast-util-from-markdown";
import type { Root, Code } from "mdast";
import { visit } from "unist-util-visit";
import { splitYamlFrontMatter } from "./yaml";
import type {
  ColorToken,
  TypographyToken,
  SpacingToken,
  RadiusToken,
  ElevationToken,
  DesignDocument,
  Provenance,
} from "../ir";

// ---------------------------------------------------------------------------
// Recognised code-block languages
// ---------------------------------------------------------------------------

const CSS_LANGS = new Set(["css", "scss", "tailwind", "theme"]);

// ---------------------------------------------------------------------------
// Provenance helper
// ---------------------------------------------------------------------------

function makeProvenance(sourceLine: number): Provenance {
  return { extractor: "css", sourceLine };
}

// ---------------------------------------------------------------------------
// CSS declaration parser
// ---------------------------------------------------------------------------

/**
 * Match a CSS custom property declaration.
 * Captures: 1 = property name (with --), 2 = value (trimmed, semicolon stripped).
 */
const DECL_RE = /^\s*(--[a-zA-Z0-9_-]+)\s*:\s*(.+?)\s*;?\s*$/;

/**
 * Determine if a code node is a CSS-like block we should extract from.
 */
function isCssBlock(node: Code): boolean {
  if (node.lang && CSS_LANGS.has(node.lang)) return true;
  // Fallback: detect `:root {` or `@theme {` in the body.
  if (node.value.includes(":root {") || node.value.includes("@theme {")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Namespace routing
// ---------------------------------------------------------------------------

interface RoutedColor extends ColorToken { _kind: "color" }
interface RoutedTypography extends TypographyToken { _kind: "typography" }
interface RoutedSpacing extends SpacingToken { _kind: "spacing" }
interface RoutedRadius extends RadiusToken { _kind: "radius" }
interface RoutedElevation extends ElevationToken { _kind: "elevation" }
interface RoutedUnknown { _kind: "unknown"; name: string; value: string; provenance: Provenance }

type RoutedToken =
  | RoutedColor
  | RoutedTypography
  | RoutedSpacing
  | RoutedRadius
  | RoutedElevation
  | RoutedUnknown;

function routeDeclaration(
  prop: string,
  value: string,
  sourceLine: number,
): RoutedToken {
  const provenance = makeProvenance(sourceLine);

  // Strip leading --
  const bare = prop.slice(2);

  if (bare.startsWith("color-")) {
    return { _kind: "color", name: bare.slice(6), value, provenance };
  }
  if (bare.startsWith("font-")) {
    return { _kind: "typography", name: bare, value: `family:${value}`, provenance };
  }
  if (bare.startsWith("text-")) {
    return { _kind: "typography", name: bare, value: `size:${value}`, provenance };
  }
  if (bare.startsWith("leading-")) {
    return { _kind: "typography", name: bare, value: `line-height:${value}`, provenance };
  }
  if (bare.startsWith("tracking-")) {
    return { _kind: "typography", name: bare, value: `letter-spacing:${value}`, provenance };
  }
  if (bare.startsWith("spacing-")) {
    return { _kind: "spacing", name: bare.slice(8), value, provenance };
  }
  if (bare.startsWith("radius-") || bare.startsWith("rounded-")) {
    const prefix = bare.startsWith("radius-") ? "radius-" : "rounded-";
    return { _kind: "radius", name: bare.slice(prefix.length), value, provenance };
  }
  if (bare.startsWith("shadow-") || bare.startsWith("elevation-")) {
    return { _kind: "elevation", name: bare.startsWith("shadow-") ? bare.slice(7) : bare.slice(10), value, provenance };
  }

  return { _kind: "unknown", name: prop, value, provenance };
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract design tokens from CSS code blocks in markdown body content.
 *
 * Mutates `doc` in place (pipeline convention).
 */
export function extractCss(doc: DesignDocument): void {
  const source = doc._sourceContent;
  if (!source) return;

  const { body, bodyLineOffset } = splitYamlFrontMatter(source);
  if (!body.trim()) return;

  let tree: Root;
  try {
    tree = fromMarkdown(body);
  } catch {
    return;
  }

  visit(tree, "code", (node: Code) => {
    if (!isCssBlock(node)) return;

    // Compute line offset for this code block.
    const blockLine = node.position?.start.line ?? 0;
    const lines = node.value.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = DECL_RE.exec(line);
      if (!match) continue;

      const prop = match[1]!;
      const value = match[2]!;
      const sourceLine = bodyLineOffset + blockLine + i;

      const token = routeDeclaration(prop, value, sourceLine);

      switch (token._kind) {
        case "color": {
          const t: ColorToken = { name: token.name, value: token.value, provenance: token.provenance };
          doc.spec.colorTokens = [...(doc.spec.colorTokens ?? []), t];
          doc.spec.colors[token.name] = token.value;
          break;
        }
        case "typography": {
          const t: TypographyToken = { name: token.name, value: token.value, provenance: token.provenance };
          doc.spec.typographyTokens = [...(doc.spec.typographyTokens ?? []), t];
          break;
        }
        case "spacing": {
          const t: SpacingToken = { name: token.name, value: token.value, provenance: token.provenance };
          doc.spec.spacingTokens = [...(doc.spec.spacingTokens ?? []), t];
          doc.spec.spacing[token.name] = token.value;
          break;
        }
        case "radius": {
          const t: RadiusToken = { name: token.name, value: token.value, provenance: token.provenance };
          doc.spec.radiusTokens = [...(doc.spec.radiusTokens ?? []), t];
          doc.spec.radii[token.name] = token.value;
          break;
        }
        case "elevation": {
          const t: ElevationToken = { name: token.name, value: token.value, provenance: token.provenance };
          doc.spec.elevationTokens = [...(doc.spec.elevationTokens ?? []), t];
          break;
        }
        case "unknown": {
          if (!doc.spec.unknown) doc.spec.unknown = {};
          doc.spec.unknown[token.name] = token.value;
          break;
        }
      }
    }
  });
}

/**
 * Run the CSS extractor on a raw content string, returning a DesignDocument.
 *
 * Convenience wrapper for use outside the pipeline.
 */
export function extractCssFromContent(content: string): DesignDocument {
  const doc: DesignDocument = {
    spec: {
      colors: {},
      typography: {},
      spacing: {},
      radii: {},
      layout: {},
      raw: {},
      colorTokens: [],
      typographyTokens: [],
      spacingTokens: [],
      radiusTokens: [],
      elevationTokens: [],
      surfaceTokens: [],
      layoutTokens: [],
      componentRecipes: [],
    },
    diagnostics: [],
    detection: { score: 0, signals: [] },
    meta: {
      name: "",
      description: "",
      sourceLength: content.length,
    },
    _sourceContent: content,
  };

  extractCss(doc);
  return doc;
}
