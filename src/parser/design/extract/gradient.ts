/**
 * Gradient extractor for the design pipeline.
 *
 * Scans prose, tables, and CSS code blocks for `linear-gradient()` and
 * `radial-gradient()` strings, parses their color stops, and emits
 * `GradientToken`s.
 *
 * Mutates `doc` in place (pipeline convention).
 */

import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import type { Code, PhrasingContent, Root } from "mdast";
import type {
  GradientToken,
  DesignDocument,
  Provenance,
} from "../ir";
import { splitYamlFrontMatter } from "./yaml";

// ---------------------------------------------------------------------------
// Provenance helper
// ---------------------------------------------------------------------------

function makeProvenance(sourceLine: number): Provenance {
  return { extractor: "gradient", sourceLine };
}

// ---------------------------------------------------------------------------
// Gradient regex
// ---------------------------------------------------------------------------

const GRADIENT_RE =
  /(?:linear-gradient|radial-gradient)\s*\((?:[^()]+|\([^()]*\))+\)/gi;

// ---------------------------------------------------------------------------
// Color-stop parser
// ---------------------------------------------------------------------------

/**
 * Patterns for individual color values inside gradient stops.
 * Matches hex (#RGB, #RRGGBB, #RRGGBBAA), rgb/rgba(...), and CSS named colors.
 */
const COLOR_PART_RE =
  /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|rgba?\s*\([^)]+\)|\b(?:aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen)\b/gi;

/**
 * Parse the inner content of a `linear-gradient(...)` or `radial-gradient(...)`
 * call into an array of color stops.
 *
 * The function strips the leading direction/shape argument (e.g. `135deg`,
 * `to right`, `circle at center`) and then walks the remaining comma-separated
 * segments to extract color + optional position pairs.
 */
function parseStops(inner: string): Array<{ color: string; position?: string }> {
  // Split on commas, trim each segment.
  const parts = inner.split(",").map((s) => s.trim());

  // Heuristic: if the first part looks like a direction/shape (no color),
  // skip it so we only process actual stops.
  const startsWithDirection = /^(?:\d+deg|to\s+|from\s+|circle|ellipse|at\s+|closest|farthest)/i;
  const start = startsWithDirection.test(parts[0] ?? "") ? 1 : 0;

  const stops: Array<{ color: string; position?: string }> = [];

  for (let i = start; i < parts.length; i++) {
    const part = parts[i]!;

    // Find all color values in this segment.
    COLOR_PART_RE.lastIndex = 0;
    const colorMatches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = COLOR_PART_RE.exec(part)) !== null) {
      colorMatches.push(m[0]!);
    }

    if (colorMatches.length === 0) continue;

    // Position: look for percentage or length after the color.
    const positionRe = /\b(\d+(?:\.\d+)?%)/g;
    const posMatches: string[] = [];
    while ((m = positionRe.exec(part)) !== null) {
      posMatches.push(m[1]!);
    }

    // First color is the stop color; first position is the stop position.
    const color = colorMatches[0]!;
    const position = posMatches.length > 0 ? posMatches[0]! : undefined;

    stops.push({ color, position });

    // If there are multiple colors in one segment (hard stops), each gets
    // its own entry. Distribute positions if available.
    for (let c = 1; c < colorMatches.length; c++) {
      stops.push({
        color: colorMatches[c]!,
        position: posMatches.length > c ? posMatches[c]! : undefined,
      });
    }
  }

  return stops;
}

// ---------------------------------------------------------------------------
// Name extraction helpers
// ---------------------------------------------------------------------------

/** Extract plain text from a phrasing content array. */
function phrasingText(nodes: PhrasingContent[]): string {
  return nodes
    .map((child) => {
      if ("value" in child) return child.value;
      if ("children" in child) return phrasingText(child.children as PhrasingContent[]);
      return "";
    })
    .join("");
}

// ---------------------------------------------------------------------------
// CSS code-block scanning
// ---------------------------------------------------------------------------

const CSS_LANGS = new Set(["css", "scss", "tailwind", "theme"]);
const CSS_DECL_RE = /^\s*(--[a-zA-Z0-9_-]+)\s*:\s*(.+?)\s*;?\s*$/;

function isCssBlock(node: Code): boolean {
  return typeof node.lang === "string" && CSS_LANGS.has(node.lang.toLowerCase());
}

/**
 * Scan CSS code blocks for gradient declarations, emitting tokens named
 * after the custom property (or a fallback counter).
 */
function scanCssBlocks(
  tree: Root,
  bodyLineOffset: number,
  existingCount: number,
): GradientToken[] {
  const tokens: GradientToken[] = [];
  let counter = existingCount + 1;

  visit(tree, "code", (node: Code) => {
    if (!isCssBlock(node)) return;

    const blockLine = node.position?.start.line ?? 0;
    const lines = node.value.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      GRADIENT_RE.lastIndex = 0;
      if (!GRADIENT_RE.test(line)) continue;

      // Reset for extraction loop.
      GRADIENT_RE.lastIndex = 0;

      const sourceLine = bodyLineOffset + blockLine + i;

      // Try to get a name from a custom property.
      const declMatch = CSS_DECL_RE.exec(line);
      const name = declMatch ? declMatch[1]! : `gradient-${counter++}`;

      // Re-match to get the actual gradient string(s).
      let gm: RegExpExecArray | null;
      while ((gm = GRADIENT_RE.exec(line)) !== null) {
        const value = gm[0]!;
        const inner = value.substring(value.indexOf("(") + 1, value.length - 1);
        const stops = parseStops(inner);

        tokens.push({
          name,
          value,
          stops: stops.length > 0 ? stops : undefined,
          provenance: makeProvenance(sourceLine),
        });
      }
    }
  });

  return tokens;
}

// ---------------------------------------------------------------------------
// Prose / table scanning
// ---------------------------------------------------------------------------

/**
 * Scan a raw text line for gradient strings and return tokens.
 * Uses `boldName` if supplied (from bold-pair prose), otherwise auto-names.
 */
function scanTextLine(
  text: string,
  sourceLine: number,
  boldName: string | undefined,
  counter: { value: number },
): GradientToken[] {
  const tokens: GradientToken[] = [];
  GRADIENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = GRADIENT_RE.exec(text)) !== null) {
    const value = m[0]!;
    const inner = value.substring(value.indexOf("(") + 1, value.length - 1);
    const stops = parseStops(inner);
    const name = boldName ?? `gradient-${counter.value++}`;

    tokens.push({
      name,
      value,
      stops: stops.length > 0 ? stops : undefined,
      provenance: makeProvenance(sourceLine),
    });
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract gradient tokens from all content regions (prose, tables, CSS code
 * blocks) in the design document's source markdown.
 *
 * Mutates `doc` in place (pipeline convention).
 */
export function extractGradient(doc: DesignDocument): void {
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

  const offset = bodyLineOffset - 1;
  const counter = { value: 1 };

  // --- Phase 1: CSS code blocks ---
  const cssTokens = scanCssBlocks(tree, bodyLineOffset, 0);
  for (const t of cssTokens) {
    counter.value++;
    doc.spec.gradientTokens = [...(doc.spec.gradientTokens ?? []), t];
  }

  // --- Phase 2: Prose & tables (line-by-line text scan) ---
  // We walk the full source line-by-line to catch gradients in prose, tables,
  // and any context the AST might not give us structured access to.
  const bodyLines = body.split("\n");

  // Build a set of source-line ranges for code blocks so we don't double-scan.
  const codeBlockLines = new Set<number>();
  visit(tree, "code", (node: Code) => {
    const start = node.position?.start.line ?? 0;
    const end = node.position?.end.line ?? start;
    for (let l = start; l <= end; l++) codeBlockLines.add(l);
  });

  // Walk AST for bold-pair context in list items.
  const boldNameByLine = new Map<number, string>();

  visit(tree, (node) => {
    if (node.type === "listItem") {
      const para = (node as unknown as { children: Array<{ type: string; children?: PhrasingContent[] }> })
        .children?.find((c) => c.type === "paragraph");
      if (!para || !para.children) return;

      // Check for strong (bold) first child.
      const first = para.children[0];
      if (first && first.type === "strong" && "children" in first) {
        const name = phrasingText(first.children as PhrasingContent[]).trim();
        const line = node.position?.start.line;
        if (name && line) {
          boldNameByLine.set(line, name);
        }
      }
    }
  });

  // Scan each body line (skip code-block lines).
  for (let i = 0; i < bodyLines.length; i++) {
    if (codeBlockLines.has(i + 1)) continue;

    const line = bodyLines[i]!;
    GRADIENT_RE.lastIndex = 0;
    if (!GRADIENT_RE.test(line)) continue;

    const sourceLine = offset + i + 1;
    const boldName = boldNameByLine.get(i + 1);

    const tokens = scanTextLine(line, sourceLine, boldName, counter);
    for (const t of tokens) {
      doc.spec.gradientTokens = [...(doc.spec.gradientTokens ?? []), t];
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Run the gradient extractor on a raw content string, returning a
 * DesignDocument.
 *
 * Convenience wrapper for use outside the pipeline.
 */
export function extractGradientFromContent(content: string): DesignDocument {
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
      gradientTokens: [],
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

  extractGradient(doc);
  return doc;
}
