/**
 * Prose-pair extractor for the design pipeline.
 *
 * Extracts design tokens from prose-style DESIGN.md content — list items with
 * bold-pattern pairs and inline hex codes.  Operates on the markdown AST
 * (mdast) produced by `mdast-util-from-markdown`, walking list items and
 * paragraphs under design-shaped headings.
 *
 * Section detection reuses the same heading-classification approach as
 * tables.ts.  All tokens carry `provenance.extractor = "prose"` with source
 * line numbers.
 */

import { fromMarkdown } from "mdast-util-from-markdown";
import type {
  Root,
  Heading,
  ListItem,
  Paragraph,
  PhrasingContent,
  Parents,
} from "mdast";
import { visit } from "unist-util-visit";
import { splitYamlFrontMatter } from "./yaml";
import type {
  ColorToken,
  TypographyToken,
  SpacingToken,
  RadiusToken,
  ElevationToken,
  LayoutToken,
  ComponentRecipe,
  DesignDocument,
  Provenance,
} from "../ir";

// ---------------------------------------------------------------------------
// Section-heading detection
// ---------------------------------------------------------------------------

const SECTION_PATTERNS: ReadonlyArray<{
  category: string;
  pattern: RegExp;
}> = [
  { category: "color", pattern: /\bcolors?\b|\bcolou?rs?\b|\bpalette\b/ },
  { category: "typography", pattern: /\btypo(?:graphy)?\b|\btype\s*scale\b/ },
  { category: "spacing", pattern: /\bspacing\b|\bspace\b/ },
  {
    category: "radius",
    pattern: /\bradiu?s\b|\brounded?\b|\bshape\b|\bcorner/,
  },
  { category: "surface", pattern: /\bsurfaces?\b/ },
  {
    category: "elevation",
    pattern: /\belevation\b|\bshadows?\b|\bdepth\b/,
  },
  { category: "layout", pattern: /\blayout\b/ },
  {
    category: "component",
    pattern:
      /\bcomponents?\b|\bbuttons?\b|\bcards?\b|\binputs?\b|\bchips?\b|\bbadges?\b/,
  },
];

function classifyHeadingText(text: string): string | undefined {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, " ");
  for (const { category, pattern } of SECTION_PATTERNS) {
    if (pattern.test(normalized)) return category;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

/** Extract plain text from a phrasing content array. */
function phrasingText(nodes: PhrasingContent[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text") return n.value;
      if (n.type === "inlineCode") return n.value;
      if ("children" in n) return phrasingText(n.children as PhrasingContent[]);
      return "";
    })
    .join("");
}

/** Extract heading text. */
function headingText(heading: Heading): string {
  return phrasingText(heading.children);
}

// ---------------------------------------------------------------------------
// Provenance helper
// ---------------------------------------------------------------------------

function makeProvenance(sourceLine: number): Provenance {
  return { extractor: "prose", sourceLine };
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/** Hex color: #RGB, #RRGGBB, or #RRGGBBAA */
const HEX_RE = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

// ---------------------------------------------------------------------------
// Weight name → numeric mapping
// ---------------------------------------------------------------------------

const WEIGHT_MAP: Record<string, string> = {
  thin: "100",
  "extra-light": "200",
  extralight: "200",
  light: "300",
  regular: "400",
  normal: "400",
  medium: "500",
  "semi-bold": "600",
  semibold: "600",
  "demi-bold": "600",
  demibold: "600",
  bold: "700",
  "extra-bold": "800",
  extrabold: "800",
  black: "900",
};

function resolveWeight(raw: string): string {
  return WEIGHT_MAP[raw.toLowerCase()] ?? raw;
}

// ---------------------------------------------------------------------------
// List-item analysis
// ---------------------------------------------------------------------------

interface BoldPair {
  /** Name extracted from the leading `strong` node. */
  name: string;
  /** Text after the strong node (leading whitespace/colon trimmed). */
  rest: string;
}

/**
 * Parse a list-item paragraph into a bold-pair: the first `strong` child
 * provides the name, and subsequent phrasing content is concatenated as
 * the rest.
 *
 * Returns `undefined` if the paragraph does not start with a `strong` node.
 */
function parseBoldPair(para: Paragraph): BoldPair | undefined {
  const children = para.children;
  if (children.length === 0) return undefined;
  const first = children[0]!;
  if (first.type !== "strong") return undefined;

  const name = phrasingText(first.children);
  const restParts: string[] = [];

  for (let i = 1; i < children.length; i++) {
    const child = children[i]!;
    if (child.type === "text") {
      restParts.push(child.value);
    } else if (child.type === "inlineCode") {
      restParts.push(child.value);
    } else if ("children" in child) {
      restParts.push(phrasingText(child.children as PhrasingContent[]));
    }
  }

  const rawRest = restParts.join("");
  // Strip leading ": " or just ":"
  const rest = rawRest.replace(/^:\s*/, "");

  return { name, rest };
}

// ---------------------------------------------------------------------------
// Source line helper
// ---------------------------------------------------------------------------

function nodeLine(node: Parents, fallback: number, offset: number): number {
  return offset + (node.position?.start.line ?? fallback);
}

// ---------------------------------------------------------------------------
// Per-category token extraction
// ---------------------------------------------------------------------------

/** Color rest patterns:
 *  "(#HEX): description"  →  value=HEX
 *  "(#HEX)"               →  value=HEX
 */
function extractColorToken(
  name: string,
  rest: string,
  line: number,
): ColorToken | undefined {
  const m = rest.match(/\(#([0-9a-fA-F]{3,8})\)/);
  if (!m) return undefined;
  return {
    name,
    value: `#${m[1]}`,
    provenance: makeProvenance(line),
  };
}

/**
 * Typography rest pattern (after the leading bold pair):
 *   "Poppins 56px extra-bold, 1.1 line height, 0.02em tracking. Description."
 *   "Nunito 16px regular, 1.5 line height. Description."
 *   "Space Mono 14px regular, 1.5 line height. Description."
 */
const TYPO_REST_RE =
  /^(.+?)\s+(\d+(?:\.\d+)?)px\s+(\S+?)(?:,\s*([\d.]+)\s+line\s*height(?:,\s*([\d.]+)em\s+tracking)?)?(?:\.\s*(.*))?$/i;

function extractTypographyToken(
  name: string,
  rest: string,
  line: number,
): TypographyToken | undefined {
  const m = rest.match(TYPO_REST_RE);
  if (!m) return undefined;

  const family = m[1];
  const size = m[2];
  const weightRaw = m[3];
  const lineHeight = m[4] ?? "";
  const letterSpacing = m[5] ?? "";

  const weight = resolveWeight(weightRaw!);

  const parts: string[] = [];
  parts.push(`family:${family}`);
  parts.push(`size:${size}px`);
  parts.push(`weight:${weight}`);
  if (lineHeight) parts.push(`line-height:${lineHeight}`);
  if (letterSpacing) parts.push(`letter-spacing:${letterSpacing}em`);

  return {
    name,
    value: parts.join("; "),
    provenance: makeProvenance(line),
  };
}

/**
 * Generic bold-key–value: "value" or "value — description".
 * Returns the value portion (before em-dash) and optional description.
 */
function splitValueDescription(rest: string): {
  value: string;
  description: string;
} {
  const idx = rest.search(/\s*[—–]\s*/);
  if (idx === -1) return { value: rest.trim(), description: "" };
  return {
    value: rest.slice(0, idx).trim(),
    description: rest.slice(idx).replace(/^\s*[—–]\s*/, "").trim(),
  };
}

// ---------------------------------------------------------------------------
// Inline hex discovery (for prose paragraphs under color sections)
// ---------------------------------------------------------------------------

function discoverInlineHexColors(
  text: string,
  line: number,
  existingNames: Set<string>,
): ColorToken[] {
  const tokens: ColorToken[] = [];
  const globalHex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
  let match: RegExpExecArray | null;
  while ((match = globalHex.exec(text)) !== null) {
    const hex = `#${match[1]}`;
    // Use surrounding text as a best-effort name.
    const before = text.slice(0, match.index).trim();
    const boldMatch = before.match(/(\S+)$/);
    const name = boldMatch ? boldMatch[1]! : hex;
    if (!existingNames.has(name)) {
      tokens.push({
        name,
        value: hex,
        provenance: makeProvenance(line),
      });
      existingNames.add(name);
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract design tokens from prose-style content (list items with bold-key
 * patterns) and populate the `DesignDocument` IR token arrays.
 *
 * Mutates `doc` in place (pipeline convention).  On parse failure, appends
 * a diagnostic and returns without populating tokens.
 */
export function extractProse(doc: DesignDocument): void {
  const source = doc._sourceContent;
  if (!source) return;

  const { body, bodyLineOffset } = splitYamlFrontMatter(source);
  if (!body.trim()) return;

  let tree: Root;
  try {
    tree = fromMarkdown(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    doc.diagnostics.push({
      severity: "error",
      token: "",
      message: `Prose extractor: markdown parse error: ${message}`,
    });
    return;
  }

  const offset = bodyLineOffset - 1;

  let currentCategory: string | undefined;
  const colorNames = new Set<string>(Object.keys(doc.spec.colors));

  visit(tree, (node) => {
    if (node.type === "heading") {
      currentCategory = classifyHeadingText(headingText(node as Heading));
      return;
    }

    if (currentCategory === undefined) return;

    // Process list items.
    if (node.type === "listItem") {
      const item = node as ListItem;
      const para = item.children.find(
        (c): c is Paragraph => c.type === "paragraph",
      );
      if (!para) return;

      const pair = parseBoldPair(para);
      if (!pair) return;

      const line = nodeLine(item, 1, offset);

      switch (currentCategory) {
        case "color": {
          const token = extractColorToken(pair.name, pair.rest, line);
          if (token) {
            colorNames.add(token.name);
            doc.spec.colorTokens = [
              ...(doc.spec.colorTokens ?? []),
              token,
            ];
            doc.spec.colors[token.name] = token.value;
          }
          break;
        }
        case "typography": {
          const token = extractTypographyToken(pair.name, pair.rest, line);
          if (token) {
            doc.spec.typographyTokens = [
              ...(doc.spec.typographyTokens ?? []),
              token,
            ];
          }
          break;
        }
        case "spacing": {
          const { value } = splitValueDescription(pair.rest);
          const token: SpacingToken = {
            name: pair.name,
            value,
            provenance: makeProvenance(line),
          };
          doc.spec.spacingTokens = [
            ...(doc.spec.spacingTokens ?? []),
            token,
          ];
          doc.spec.spacing[token.name] = token.value;
          break;
        }
        case "radius": {
          const { value } = splitValueDescription(pair.rest);
          const token: RadiusToken = {
            name: pair.name,
            value,
            provenance: makeProvenance(line),
          };
          doc.spec.radiusTokens = [
            ...(doc.spec.radiusTokens ?? []),
            token,
          ];
          doc.spec.radii[token.name] = token.value;
          break;
        }
        case "elevation": {
          const { value } = splitValueDescription(pair.rest);
          const token: ElevationToken = {
            name: pair.name,
            value,
            provenance: makeProvenance(line),
          };
          doc.spec.elevationTokens = [
            ...(doc.spec.elevationTokens ?? []),
            token,
          ];
          break;
        }
        case "layout": {
          const token: LayoutToken = {
            name: pair.name,
            value: pair.rest,
            provenance: makeProvenance(line),
          };
          doc.spec.layoutTokens = [
            ...(doc.spec.layoutTokens ?? []),
            token,
          ];
          doc.spec.layout[token.name] = token.value;
          break;
        }
        case "component": {
          const recipe: ComponentRecipe = {
            name: pair.name,
            properties: { description: pair.rest },
            provenance: makeProvenance(line),
          };
          doc.spec.componentRecipes = [
            ...(doc.spec.componentRecipes ?? []),
            recipe,
          ];
          break;
        }
      }
      return;
    }

    // Scan paragraphs under color sections for inline hex codes that
    // weren't captured as bold pairs.
    if (node.type === "paragraph" && currentCategory === "color") {
      const para = node as Paragraph;
      // Only scan paragraphs that don't start with bold (those are handled
      // via list items above).
      if (para.children.length > 0 && para.children[0]!.type === "strong")
        return;

      const text = phrasingText(para.children);
      if (HEX_RE.test(text)) {
        const line = nodeLine(para, 1, offset);
        const tokens = discoverInlineHexColors(text, line, colorNames);
        for (const token of tokens) {
          doc.spec.colorTokens = [
            ...(doc.spec.colorTokens ?? []),
            token,
          ];
          doc.spec.colors[token.name] = token.value;
        }
      }
    }
  });
}

/**
 * Run the prose extractor on a raw content string, returning a DesignDocument.
 *
 * Convenience wrapper for use outside the pipeline.
 */
export function extractProseFromContent(content: string): DesignDocument {
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

  extractProse(doc);
  return doc;
}
