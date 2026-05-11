/**
 * Shadow/elevation extractor for the design pipeline.
 *
 * Extracts elevation tokens from two sources:
 *   1. Prose list items under elevation/shadow/depth headings — bold-pair
 *      pattern: `**Name**: shadow-value — description`.
 *   2. CSS code blocks containing `--shadow-*` or `--elevation-*` custom
 *      property declarations.
 *
 * All tokens carry `provenance.extractor = "shadow"` with source line numbers.
 */

import { fromMarkdown } from "mdast-util-from-markdown";
import type { Root, Heading, ListItem, Paragraph, PhrasingContent, Code } from "mdast";
import { visit } from "unist-util-visit";
import { splitYamlFrontMatter } from "./yaml";
import type { DesignDocument, Provenance } from "../ir";

// ---------------------------------------------------------------------------
// Section-heading detection
// ---------------------------------------------------------------------------

const SECTION_PATTERNS: ReadonlyArray<{
  category: string;
  pattern: RegExp;
}> = [
  { category: "elevation", pattern: /\belevation\b|\bshadows?\b|\bdepth\b/ },
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
  return { extractor: "shadow", sourceLine };
}

// ---------------------------------------------------------------------------
// Bold-pair parsing (reused from prose pattern)
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
      restParts.push(phrasingText(child.children as PhrasingContent[]));
    }
  }

  const rawRest = restParts.join("");
  // Strip leading ": " or just ":"
  const rest = rawRest.replace(/^:\s*/, "");

  return { name, rest };
}

// ---------------------------------------------------------------------------
// Value/description splitting
// ---------------------------------------------------------------------------

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
// CSS code block scanning
// ---------------------------------------------------------------------------

const CSS_LANGS = new Set(["css", "scss", "tailwind", "theme"]);

const DECL_RE = /^\s*(--shadow-[a-zA-Z0-9_-]+|--elevation-[a-zA-Z0-9_-]+)\s*:\s*(.+?)\s*;?\s*$/;

function isCssBlock(node: Code): boolean {
  if (node.lang && CSS_LANGS.has(node.lang)) return true;
  if (node.value.includes(":root {") || node.value.includes("@theme {")) return true;
  return false;
}

function extractCssShadows(doc: DesignDocument, tree: Root, offset: number): void {
  visit(tree, "code", (node: Code) => {
    if (!isCssBlock(node)) return;

    const blockLine = node.position?.start.line ?? 0;
    const lines = node.value.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = DECL_RE.exec(line);
      if (!match) continue;

      const prop = match[1]!;
      const value = match[2]!;
      const sourceLine = offset + blockLine + i;

      // Strip leading -- and namespace prefix to get the token name.
      const bare = prop.slice(2); // e.g. "shadow-subtle" or "elevation-subtle"
      const name = bare.startsWith("shadow-")
        ? bare.slice(7)
        : bare.startsWith("elevation-")
          ? bare.slice(10)
          : bare;

      doc.spec.elevationTokens = [
        ...(doc.spec.elevationTokens ?? []),
        { name, value, provenance: makeProvenance(sourceLine) },
      ];
    }
  });
}

// ---------------------------------------------------------------------------
// Source line helper
// ---------------------------------------------------------------------------

function nodeLine(line: number | undefined, fallback: number, offset: number): number {
  return offset + (line ?? fallback);
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract shadow/elevation tokens from prose list items and CSS code blocks.
 *
 * Mutates `doc` in place (pipeline convention).
 */
export function extractShadow(doc: DesignDocument): void {
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

  // --- Pass 1: prose list items under elevation/shadow/depth headings ---
  let currentCategory: string | undefined;

  visit(tree, (node) => {
    if (node.type === "heading") {
      currentCategory = classifyHeadingText(headingText(node as Heading));
      return;
    }

    if (currentCategory !== "elevation") return;

    if (node.type === "listItem") {
      const item = node as ListItem;
      const para = item.children.find(
        (c): c is Paragraph => c.type === "paragraph",
      );
      if (!para) return;

      const pair = parseBoldPair(para);
      if (!pair) return;

      const { value } = splitValueDescription(pair.rest);

      // Only accept values that look like CSS shadow values
      // (contain at least one length unit like "px")
      if (!/\dpx/i.test(value)) return;

      const line = nodeLine(
        item.position?.start.line,
        1,
        offset,
      );

      doc.spec.elevationTokens = [
        ...(doc.spec.elevationTokens ?? []),
        {
          name: pair.name,
          value,
          provenance: makeProvenance(line),
        },
      ];
    }
  });

  // --- Pass 2: CSS code blocks with --shadow-* / --elevation-* ---
  extractCssShadows(doc, tree, offset);
}

/**
 * Run the shadow extractor on a raw content string, returning a DesignDocument.
 *
 * Convenience wrapper for use outside the pipeline.
 */
export function extractShadowFromContent(content: string): DesignDocument {
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

  extractShadow(doc);
  return doc;
}
