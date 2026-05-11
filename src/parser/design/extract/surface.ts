/**
 * Surface extractor for the design pipeline.
 *
 * Extracts SurfaceTokens from GFM tables and prose list items under
 * "surface"-classified headings.  Tables are column-classified to locate name
 * and value columns; list items use the bold-pair pattern.  All tokens carry
 * `provenance.extractor = "surface"` with source line numbers.
 */

import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmTable } from "micromark-extension-gfm-table";
import type {
  Root,
  Heading,
  Table,
  TableRow,
  TableCell,
  ListItem,
  Paragraph,
  PhrasingContent,
} from "mdast";
import { visit } from "unist-util-visit";
import { splitYamlFrontMatter } from "./yaml";
import type { SurfaceToken, DesignDocument, Provenance } from "../ir";

// ---------------------------------------------------------------------------
// Section-heading detection
// ---------------------------------------------------------------------------

const SECTION_PATTERNS: ReadonlyArray<{
  category: string;
  pattern: RegExp;
}> = [
  { category: "surface", pattern: /\bsurfaces?\b/ },
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

/** Strip backtick fences from a cell value. */
function stripBackticks(raw: string): string {
  return raw.replace(/^`+/, "").replace(/`+$/, "");
}

/** Extract cell text from a table cell. */
function cellText(cell: TableCell): string {
  return stripBackticks(phrasingText(cell.children));
}

// ---------------------------------------------------------------------------
// Provenance helper
// ---------------------------------------------------------------------------

function makeProvenance(sourceLine: number): Provenance {
  return { extractor: "surface", sourceLine };
}

// ---------------------------------------------------------------------------
// Column-role detection
// ---------------------------------------------------------------------------

const COLUMN_PATTERNS: ReadonlyArray<{
  role: string;
  pattern: RegExp;
}> = [
  { role: "name", pattern: /\bname\b|\btoken\b|\brole\b|\busage\b|\blabel\b/ },
  { role: "value", pattern: /\bvalue\b|\bhex\b|\bcolor\b/ },
  { role: "level", pattern: /\blevel\b/ },
  { role: "description", pattern: /\bdescription\b|\bpurpose\b|\bnote\b/ },
];

function classifyColumn(headerText: string): string | undefined {
  const normalized = headerText.toLowerCase().replace(/[^\w\s]/g, " ");
  for (const { role, pattern } of COLUMN_PATTERNS) {
    if (pattern.test(normalized)) return role;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Table extraction
// ---------------------------------------------------------------------------

interface ColumnMapping {
  name: number | undefined;
  value: number | undefined;
  level: number | undefined;
  description: number | undefined;
}

function buildColumnMapping(headerRow: TableRow): ColumnMapping | undefined {
  const cells = headerRow.children;
  if (cells.length < 2) return undefined;

  const mapping: ColumnMapping = {
    name: undefined,
    value: undefined,
    level: undefined,
    description: undefined,
  };

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const text = phrasingText(cell.children);
    const role = classifyColumn(text);
    if (role === "name" && mapping.name === undefined) mapping.name = i;
    else if (role === "value" && mapping.value === undefined)
      mapping.value = i;
    else if (role === "level" && mapping.level === undefined)
      mapping.level = i;
    else if (role === "description" && mapping.description === undefined)
      mapping.description = i;
  }

  return mapping;
}

function cellAt(row: TableRow, col: number | undefined): string {
  if (col === undefined || col >= row.children.length) return "";
  return cellText(row.children[col]!);
}

function extractTokensFromTable(
  table: Table,
  lineOffset: number,
): SurfaceToken[] {
  const rows = table.children;
  if (rows.length < 2) return [];

  const headerRow = rows[0]!;
  const mapping = buildColumnMapping(headerRow);
  if (!mapping) return [];

  // Name column is essential; fall back to index 1 (common: Level | Name | ...)
  const nameCol = mapping.name ?? 1;
  const valueCol = mapping.value ?? 2;

  const tokens: SurfaceToken[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    const name = cellAt(row, nameCol);
    const value = cellAt(row, valueCol);
    if (!name && !value) continue;
    tokens.push({
      name,
      value,
      provenance: makeProvenance(
        lineOffset + (row.position?.start.line ?? i + 1),
      ),
    });
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Bold-pair extraction (for list items)
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
  const rest = rawRest.replace(/^:\s*/, "");

  return { name, rest };
}

/** Split "value — description" into value and optional description. */
function splitValueDescription(rest: string): {
  value: string;
  description: string;
} {
  const idx = rest.indexOf(" — ");
  if (idx === -1) return { value: rest.trim(), description: "" };
  return {
    value: rest.slice(0, idx).trim(),
    description: rest.slice(idx + 3).trim(),
  };
}

// ---------------------------------------------------------------------------
// Source line helper
// ---------------------------------------------------------------------------

function nodeLine(
  node: { position?: { start: { line: number } } },
  fallback: number,
  offset: number,
): number {
  return offset + (node.position?.start.line ?? fallback);
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract surface design tokens from markdown content and populate
 * `doc.spec.surfaceTokens`.  Handles GFM tables and prose list items
 * under surface-classified headings.
 */
export function extractSurface(doc: DesignDocument): void {
  const source = doc._sourceContent;
  if (!source) return;

  const { body, bodyLineOffset } = splitYamlFrontMatter(source);
  if (!body.trim()) return;

  let tree: Root;
  try {
    tree = fromMarkdown(body, {
      extensions: [gfmTable()],
      mdastExtensions: [gfmTableFromMarkdown()],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    doc.diagnostics.push({
      severity: "error",
      token: "",
      message: `Surface extractor: markdown parse error: ${message}`,
    });
    return;
  }

  const offset = bodyLineOffset - 1;
  let inSurfaceSection = false;

  visit(tree, (node) => {
    if (node.type === "heading") {
      const category = classifyHeadingText(headingText(node as Heading));
      inSurfaceSection = category === "surface";
      return;
    }

    if (!inSurfaceSection) return;

    // Handle GFM tables.
    if (node.type === "table") {
      const table = node as Table;
      const tokens = extractTokensFromTable(table, offset);
      for (const token of tokens) {
        doc.spec.surfaceTokens = [...(doc.spec.surfaceTokens ?? []), token];
      }
      return;
    }

    // Handle list items with bold-pair pattern.
    if (node.type === "listItem") {
      const item = node as ListItem;
      const para = item.children.find(
        (c): c is Paragraph => c.type === "paragraph",
      );
      if (!para) return;

      const pair = parseBoldPair(para);
      if (!pair) return;

      const line = nodeLine(item, 1, offset);
      const { value } = splitValueDescription(pair.rest);
      const token: SurfaceToken = {
        name: pair.name,
        value,
        provenance: makeProvenance(line),
      };
      doc.spec.surfaceTokens = [...(doc.spec.surfaceTokens ?? []), token];
      return;
    }
  });
}

/**
 * Run the surface extractor on a raw content string, returning a
 * DesignDocument.
 *
 * Convenience wrapper for use outside the pipeline.
 */
export function extractSurfaceFromContent(content: string): DesignDocument {
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
  extractSurface(doc);
  return doc;
}
