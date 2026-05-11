/**
 * Layout extractor for the design pipeline.
 *
 * Extracts LayoutTokens from markdown content under headings that match
 * "layout"-related patterns. Supports:
 *   - Bold-pair list items: `**name**: value`
 *   - Plain key-colon-value list items: `Base unit: 8px`
 *   - Inline bold patterns in paragraphs: `**Theme:** Light | **Density:** Comfortable`
 */

import { fromMarkdown } from "mdast-util-from-markdown";
import type {
  Root,
  Heading,
  ListItem,
  Paragraph,
  PhrasingContent,
} from "mdast";
import { visit } from "unist-util-visit";
import type { LayoutToken, DesignDocument, Provenance } from "../ir";
import { splitYamlFrontMatter } from "./yaml";

// ---------------------------------------------------------------------------
// Section-heading detection
// ---------------------------------------------------------------------------

const LAYOUT_RE = /\blayout\b/i;

function isLayoutHeading(text: string): boolean {
  return LAYOUT_RE.test(text);
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
      if ("children" in n)
        return phrasingText(n.children as PhrasingContent[]);
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
  return { extractor: "layout", sourceLine };
}

// ---------------------------------------------------------------------------
// Source line helper
// ---------------------------------------------------------------------------

function nodeLine(
  node: { position?: { start?: { line?: number } } },
  fallback: number,
  offset: number,
): number {
  return offset + (node.position?.start?.line ?? fallback);
}

// ---------------------------------------------------------------------------
// Bold-pair extraction from a paragraph
// ---------------------------------------------------------------------------

interface BoldPair {
  name: string;
  rest: string;
}

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
      restParts.push(
        phrasingText((child as { children: PhrasingContent[] }).children),
      );
    }
  }

  const rawRest = restParts.join("");
  const rest = rawRest.replace(/^:\s*/, "");

  return { name, rest };
}

// ---------------------------------------------------------------------------
// Plain key: value list-item extraction
// ---------------------------------------------------------------------------

/** Match "Key: Value" — captures the key before the first colon and the rest. */
const KV_RE = /^([^:]{1,80}):\s*(.+)$/;

function parsePlainKeyValue(para: Paragraph): BoldPair | undefined {
  const text = phrasingText(para.children).trim();
  const m = KV_RE.exec(text);
  if (!m) return undefined;
  return { name: m[1]!.trim(), rest: m[2]!.trim() };
}

// ---------------------------------------------------------------------------
// Inline bold key-value extraction from paragraphs at AST level
// (e.g. **Theme:** Light | **Density:** Comfortable | **Base unit:** 4px)
// ---------------------------------------------------------------------------

function extractInlineBoldTokensFromPara(
  para: Paragraph,
  line: number,
): LayoutToken[] {
  const tokens: LayoutToken[] = [];
  const children = para.children;

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (child.type !== "strong") continue;

    const nameRaw = phrasingText(child.children).trim();
    // Strip trailing colon from the name
    const name = nameRaw.replace(/:\s*$/, "");
    if (!name) continue;

    // Collect text following the strong node until the next strong node
    const restParts: string[] = [];
    for (let j = i + 1; j < children.length; j++) {
      const next = children[j]!;
      if (next.type === "strong") break;
      if (next.type === "text") {
        restParts.push(next.value);
      } else if (next.type === "inlineCode") {
        restParts.push(next.value);
      } else if ("children" in next) {
        restParts.push(
          phrasingText((next as { children: PhrasingContent[] }).children),
        );
      }
    }

    const value = restParts.join("").replace(/^\s*\|\s*/, "").replace(/\s*\|\s*$/, "").trim();
    if (value) {
      tokens.push({
        name,
        value,
        provenance: makeProvenance(line),
      });
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Token appending helper
// ---------------------------------------------------------------------------

function appendToken(doc: DesignDocument, token: LayoutToken): void {
  doc.spec.layoutTokens = [...(doc.spec.layoutTokens ?? []), token];
  doc.spec.layout[token.name] = token.value;
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract layout tokens from prose-style content under layout headings.
 * Mutates `doc` in place.
 */
export function extractLayout(doc: DesignDocument): void {
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
      message: `Layout extractor: markdown parse error: ${message}`,
    });
    return;
  }

  const offset = bodyLineOffset - 1;
  let inLayout = false;

  visit(tree, (node, _index, parent) => {
    // Track section scope via headings.
    if (node.type === "heading") {
      inLayout = isLayoutHeading(headingText(node as Heading));
      return;
    }

    if (!inLayout) return;

    // Process list items.
    if (node.type === "listItem") {
      const item = node as ListItem;
      const para = item.children.find(
        (c): c is Paragraph => c.type === "paragraph",
      );
      if (!para) return;

      const line = nodeLine(item, 1, offset);

      // Try bold-pair first: **name**: value
      const pair = parseBoldPair(para);
      if (pair) {
        appendToken(doc, {
          name: pair.name,
          value: pair.rest,
          provenance: makeProvenance(line),
        });
        return;
      }

      // Fallback: plain key: value
      const kv = parsePlainKeyValue(para);
      if (kv) {
        appendToken(doc, {
          name: kv.name,
          value: kv.rest,
          provenance: makeProvenance(line),
        });
      }
      return;
    }

    // Scan paragraphs for inline bold key-value patterns at AST level.
    // Handles patterns like: **Theme:** Light | **Density:** Comfortable | **Base unit:** 4px
    if (node.type === "paragraph" && parent?.type !== "listItem") {
      const para = node as Paragraph;
      const strongCount = para.children.filter(
        (c) => c.type === "strong",
      ).length;
      if (strongCount === 0) return;

      const line = nodeLine(para, 1, offset);
      const tokens = extractInlineBoldTokensFromPara(para, line);
      for (const token of tokens) {
        appendToken(doc, token);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Run the layout extractor on a raw content string, returning a DesignDocument.
 *
 * Convenience wrapper for use outside the pipeline.
 */
export function extractLayoutFromContent(content: string): DesignDocument {
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
  extractLayout(doc);
  return doc;
}
