/**
 * GFM table extractor for the design pipeline.
 *
 * Walks the markdown AST (body content after YAML frontmatter is stripped)
 * and extracts design tokens from GFM tables found under design-shaped headings.
 *
 * Section detection uses fuzzy heading matching.  Column-role detection infers
 * the semantic purpose of each column from header keywords.  Extracted tokens
 * carry `provenance.extractor = "table"` with source line numbers.
 */

import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmTable } from "micromark-extension-gfm-table";
import type { Root, Table, TableRow, TableCell, Heading, PhrasingContent } from "mdast";
import { visit } from "unist-util-visit";
import { splitYamlFrontMatter } from "./yaml";
import type {
  ColorToken,
  TypographyToken,
  SpacingToken,
  RadiusToken,
  ElevationToken,
  SurfaceToken,
  LayoutToken,
  ComponentRecipe,
  DesignDocument,
  Provenance,
} from "../ir";

// ---------------------------------------------------------------------------
// Section-heading detection
// ---------------------------------------------------------------------------

/**
 * Maps a heading's normalized text to a design category.
 * Returns `undefined` if no category matches.
 */
const SECTION_PATTERNS: ReadonlyArray<{
  /** Unique category identifier. */
  category: string;
  /** Regex tested against the lowercased, stripped heading text. */
  pattern: RegExp;
}> = [
  { category: "color", pattern: /\bcolors?\b|\bcolou?rs?\b/ },
  { category: "typography", pattern: /\btypo(?:graphy)?\b|\btype\s*scale\b/ },
  { category: "spacing", pattern: /\bspacing\b/ },
  { category: "radius", pattern: /\bradiu?s\b|\brounded?\b|\bshape/ },
  { category: "surface", pattern: /\bsurfaces?\b/ },
  { category: "elevation", pattern: /\belevation\b|\bshadows?\b/ },
  { category: "layout", pattern: /\blayout\b/ },
  { category: "component", pattern: /\bcomponents?\b|\bbuttons?\b|\bcards?\b|\binputs?\b|\bchips?\b|\bbadges?\b/ },
];

function classifyHeading(heading: Heading): string | undefined {
  const text = headingText(heading).toLowerCase().replace(/[^\w\s]/g, " ");
  for (const { category, pattern } of SECTION_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return undefined;
}

/**
 * Recognised colour-palette subheading patterns.
 * When a subheading under a "Colors" section matches one of these,
 * it should inherit the "color" category instead of clearing it.
 * The palette label is returned so tokens can be annotated.
 */
const COLOR_SUBHEADING_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  group: string;
}> = [
  { pattern: /\bbrand\s*palette\b/, group: "Brand" },
  { pattern: /\bneutral\s*palette\b/, group: "Neutrals" },
  { pattern: /\bsurface\s*palette\b/, group: "Surface" },
  { pattern: /\bcontent\s*palette\b/, group: "Content" },
  { pattern: /\bborder\s*palette\b/, group: "Border" },
  { pattern: /\bsemantic\s*(?:colors|colou?rs|palette)\b/, group: "Semantic" },
  { pattern: /\bpalette\b/, group: "Other" },
];

/**
 * If a heading looks like a colour-palette subheading (e.g. "Brand Palette",
 * "Surface Palette"), return the group label. Otherwise return `undefined`.
 */
function classifyColorSubheading(heading: Heading): string | undefined {
  const text = headingText(heading).toLowerCase().replace(/[^\w\s]/g, " ");
  for (const { pattern, group } of COLOR_SUBHEADING_PATTERNS) {
    if (pattern.test(text)) return group;
  }
  return undefined;
}

/**
 * Map a palette-group label to the best `ColorGroup` value.
 * Returns `undefined` when there is no natural mapping.
 */
function paletteGroupToColorGroup(paletteGroup: string): string | undefined {
  switch (paletteGroup) {
    case "Brand": return "Brand";
    case "Neutrals": return "Neutrals";
    case "Surface": return "Surface";
    case "Semantic": return "Semantic";
    default: return "Other";
  }
}

// ---------------------------------------------------------------------------
// Column-role detection
// ---------------------------------------------------------------------------

const COLUMN_PATTERNS: ReadonlyArray<{
  /** Semantic role for the column. */
  role: string;
  /** Regex tested against the lowercased, stripped header cell text. */
  pattern: RegExp;
}> = [
  { role: "name", pattern: /\bname\b|\btoken\b|\brole\b|\busage\b|\blabel\b/ },
  { role: "value", pattern: /\bvalue\b|\bhex\b|\bcolor\b|\bsize\b/ },
  { role: "description", pattern: /\bdescription\b|\bpurpose\b|\blevel\b/ },
  { role: "family", pattern: /\bfamily\b|\bfont\b/ },
  { role: "weight", pattern: /\bweight\b/ },
  { role: "lineHeight", pattern: /\bline\s*height\b/ },
  { role: "letterSpacing", pattern: /\bletter\s*spacing\b/ },
];

function classifyColumn(headerText: string): string | undefined {
  const normalized = headerText.toLowerCase().replace(/[^\w\s]/g, " ");
  for (const { role, pattern } of COLUMN_PATTERNS) {
    if (pattern.test(normalized)) return role;
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
// Token builders (per category)
// ---------------------------------------------------------------------------

function makeProvenance(sourceLine: number): Provenance {
  return { extractor: "table", sourceLine };
}

interface ColumnMapping {
  name: number | undefined;
  value: number | undefined;
  description: number | undefined;
  family: number | undefined;
  weight: number | undefined;
  lineHeight: number | undefined;
  letterSpacing: number | undefined;
}

function buildColumnMapping(
  headerRow: TableRow,
): ColumnMapping | undefined {
  const cells = headerRow.children;
  if (cells.length < 2) return undefined; // malformed / 1-column table

  const mapping: ColumnMapping = {
    name: undefined,
    value: undefined,
    description: undefined,
    family: undefined,
    weight: undefined,
    lineHeight: undefined,
    letterSpacing: undefined,
  };

  for (let i = 0; i < cells.length; i++) {
    const text = phrasingText(cells[i]!.children);
    const role = classifyColumn(text);
    if (role === "name" && mapping.name === undefined) mapping.name = i;
    else if (role === "name" && mapping.name !== undefined && mapping.description === undefined) {
      // "Role" or "Usage" as a column header may act as description when
      // the name slot is already filled by a "Name" or "Token" column.
      const lower = text.toLowerCase().replace(/[^\w\s]/g, " ");
      if (/\brole\b|\busage\b|\bpurpose\b/.test(lower)) {
        mapping.description = i;
      }
    }
    else if (role === "value" && mapping.value === undefined) mapping.value = i;
    else if (role === "description" && mapping.description === undefined) mapping.description = i;
    else if (role === "family" && mapping.family === undefined) mapping.family = i;
    else if (role === "weight" && mapping.weight === undefined) mapping.weight = i;
    else if (role === "lineHeight" && mapping.lineHeight === undefined) mapping.lineHeight = i;
    else if (role === "letterSpacing" && mapping.letterSpacing === undefined) mapping.letterSpacing = i;
  }

  return mapping;
}

/**
 * Get the cell value at the given column index, or empty string.
 * Handles backtick stripping.
 */
function cellAt(row: TableRow, col: number | undefined): string {
  if (col === undefined || col >= row.children.length) return "";
  return cellText(row.children[col]!);
}

// ---------------------------------------------------------------------------
// Per-category token extraction
// ---------------------------------------------------------------------------

function extractColorTokens(
  rows: TableRow[],
  mapping: ColumnMapping,
  lineOffset: number,
  paletteGroup?: string,
): ColorToken[] {
  const nameCol = mapping.name ?? 0;
  const valueCol = mapping.value ?? 1;
  const tokens: ColorToken[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const name = cellAt(row, nameCol);
    const value = cellAt(row, valueCol);
    if (!name && !value) continue;
    const description = cellAt(row, mapping.description) || undefined;
    const token: ColorToken = {
      name,
      value,
      provenance: makeProvenance(lineOffset + (row.position?.start.line ?? i + 1)),
    };
    if (description) {
      token.description = paletteGroup
        ? `${paletteGroup}: ${description}`
        : description;
    } else if (paletteGroup) {
      token.description = paletteGroup;
    }
    const colorGroup = paletteGroup
      ? paletteGroupToColorGroup(paletteGroup)
      : undefined;
    if (colorGroup) {
      token.group = colorGroup as import("../ir").ColorGroup;
    }
    tokens.push(token);
  }
  return tokens;
}

function extractTypographyTokens(
  rows: TableRow[],
  mapping: ColumnMapping,
  lineOffset: number,
): TypographyToken[] {
  // Name comes from "name" or "role" column; value is synthesized from
  // size + family + weight.
  const nameCol = mapping.name ?? 0;
  const tokens: TypographyToken[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const name = cellAt(row, nameCol);
    if (!name) continue;

    // Build a composite value from available columns.
    const parts: string[] = [];
    const sizeVal = cellAt(row, mapping.value);
    if (sizeVal) parts.push(`size:${sizeVal}`);
    const lhVal = cellAt(row, mapping.lineHeight);
    if (lhVal && lhVal !== "—") parts.push(`line-height:${lhVal}`);
    const lsVal = cellAt(row, mapping.letterSpacing);
    if (lsVal && lsVal !== "—") parts.push(`letter-spacing:${lsVal}`);
    const famVal = cellAt(row, mapping.family);
    if (famVal) parts.push(`family:${famVal}`);
    const wtVal = cellAt(row, mapping.weight);
    if (wtVal) parts.push(`weight:${wtVal}`);

    const value = parts.length > 0 ? parts.join("; ") : cellAt(row, mapping.value ?? 1);
    tokens.push({
      name,
      value,
      provenance: makeProvenance(lineOffset + (row.position?.start.line ?? i + 1)),
    });
  }
  return tokens;
}

function extractSpacingTokens(
  rows: TableRow[],
  mapping: ColumnMapping,
  lineOffset: number,
): SpacingToken[] {
  const nameCol = mapping.name ?? 0;
  const valueCol = mapping.value ?? 1;
  const tokens: SpacingToken[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const name = cellAt(row, nameCol);
    const value = cellAt(row, valueCol);
    if (!name && !value) continue;
    tokens.push({
      name,
      value,
      provenance: makeProvenance(lineOffset + (row.position?.start.line ?? i + 1)),
    });
  }
  return tokens;
}

function extractRadiusTokens(
  rows: TableRow[],
  mapping: ColumnMapping,
  lineOffset: number,
): RadiusToken[] {
  const nameCol = mapping.name ?? 0;
  const valueCol = mapping.value ?? 1;
  const tokens: RadiusToken[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const name = cellAt(row, nameCol);
    const value = cellAt(row, valueCol);
    if (!name && !value) continue;
    tokens.push({
      name,
      value,
      provenance: makeProvenance(lineOffset + (row.position?.start.line ?? i + 1)),
    });
  }
  return tokens;
}

function extractSurfaceTokens(
  rows: TableRow[],
  mapping: ColumnMapping,
  lineOffset: number,
): SurfaceToken[] {
  // For surfaces, the "name" column is preferred; fall back to description.
  const nameCol = mapping.name ?? mapping.description ?? 0;
  const valueCol = mapping.value ?? 2;
  const tokens: SurfaceToken[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const name = cellAt(row, nameCol);
    const value = cellAt(row, valueCol);
    if (!name && !value) continue;
    tokens.push({
      name,
      value,
      provenance: makeProvenance(lineOffset + (row.position?.start.line ?? i + 1)),
    });
  }
  return tokens;
}

function extractElevationTokens(
  rows: TableRow[],
  mapping: ColumnMapping,
  lineOffset: number,
): ElevationToken[] {
  const nameCol = mapping.name ?? 0;
  const valueCol = mapping.value ?? 1;
  const tokens: ElevationToken[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const name = cellAt(row, nameCol);
    const value = cellAt(row, valueCol);
    if (!name && !value) continue;
    tokens.push({
      name,
      value,
      provenance: makeProvenance(lineOffset + (row.position?.start.line ?? i + 1)),
    });
  }
  return tokens;
}

function extractLayoutTokens(
  rows: TableRow[],
  mapping: ColumnMapping,
  lineOffset: number,
): LayoutToken[] {
  const nameCol = mapping.name ?? 0;
  const valueCol = mapping.value ?? 1;
  const tokens: LayoutToken[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const name = cellAt(row, nameCol);
    const value = cellAt(row, valueCol);
    if (!name && !value) continue;
    tokens.push({
      name,
      value,
      provenance: makeProvenance(lineOffset + (row.position?.start.line ?? i + 1)),
    });
  }
  return tokens;
}

function extractComponentRecipes(
  rows: TableRow[],
  mapping: ColumnMapping,
  lineOffset: number,
  headerRow: TableRow,
): ComponentRecipe[] {
  const nameCol = mapping.name ?? 0;
  const recipes: ComponentRecipe[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const name = cellAt(row, nameCol);
    if (!name) continue;
    const props: Record<string, string> = {};
    for (let c = 0; c < row.children.length; c++) {
      if (c === nameCol) continue;
      const headerText = phrasingText(
        headerRow.children[c]?.children ??
          ([] as PhrasingContent[]),
      );
      const key = headerText || `col${c}`;
      props[key] = cellText(row.children[c]!);
    }
    recipes.push({
      name,
      properties: props,
      provenance: makeProvenance(lineOffset + (row.position?.start.line ?? i + 1)),
    });
  }
  return recipes;
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract design tokens from GFM tables in markdown body content and populate
 * the `DesignDocument` IR token arrays.
 *
 * Mutates `doc` in place (pipeline convention).  On parse failure, appends
 * a diagnostic and returns without populating tokens.
 */
export function extractTables(doc: DesignDocument): void {
  const source = doc._sourceContent;
  if (!source) return;

  const { body, bodyLineOffset } = splitYamlFrontMatter(source);
  if (!body.trim()) return;

  // Parse markdown AST with GFM table support.
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
      message: `Table extractor: markdown parse error: ${message}`,
    });
    return;
  }

  // Walk the tree: each heading establishes context for subsequent tables.
  // Subheadings deeper than the section heading inherit the parent category
  // if they don't introduce a new section themselves.
  let currentCategory: string | undefined;
  let sectionDepth: number | undefined;
  let currentPaletteGroup: string | undefined;

  visit(tree, (node) => {
    if (node.type === "heading") {
      const heading = node as Heading;
      const depth = heading.depth;

      const newCategory = classifyHeading(heading);

      // When we are inside a "color" section and this is a deeper heading,
      // check if it is a colour-palette subheading FIRST.  Palette names
      // like "Surface Palette" would otherwise match the "surface" section
      // pattern and break the colour context.
      if (currentCategory === "color" && depth > (sectionDepth ?? 0)) {
        const paletteGroup = classifyColorSubheading(heading);
        if (paletteGroup !== undefined) {
          currentPaletteGroup = paletteGroup;
          return;
        }
      }

      if (newCategory !== undefined) {
        currentCategory = newCategory;
        sectionDepth = depth;
        currentPaletteGroup = undefined;
        if (newCategory === "color") {
          currentPaletteGroup = classifyColorSubheading(heading);
        }
        return;
      }

      // Any heading at the same or shallower depth as the current section
      // resets context — we've left the section.
      if (sectionDepth !== undefined && depth <= sectionDepth) {
        currentCategory = undefined;
        sectionDepth = undefined;
        currentPaletteGroup = undefined;
        return;
      }

      return;
    }

    if (node.type !== "table" || currentCategory === undefined) return;

    const table = node as Table;
    const rows = table.children;
    if (rows.length < 2) return; // header only or empty

    const headerRow = rows[0]!;
    const mapping = buildColumnMapping(headerRow);
    if (mapping === undefined) return; // 1-column / malformed

    const dataRows = rows.slice(1);
    const lineOffset = bodyLineOffset - 1; // convert 1-indexed to line numbers

    switch (currentCategory) {
      case "color": {
        const tokens = extractColorTokens(dataRows, mapping, lineOffset, currentPaletteGroup);
        doc.spec.colorTokens = [...(doc.spec.colorTokens ?? []), ...tokens];
        // Legacy flat map.
        for (const t of tokens) {
          doc.spec.colors[t.name] = t.value;
        }
        break;
      }
      case "typography": {
        const tokens = extractTypographyTokens(dataRows, mapping, lineOffset);
        doc.spec.typographyTokens = [
          ...(doc.spec.typographyTokens ?? []),
          ...tokens,
        ];
        break;
      }
      case "spacing": {
        const tokens = extractSpacingTokens(dataRows, mapping, lineOffset);
        doc.spec.spacingTokens = [...(doc.spec.spacingTokens ?? []), ...tokens];
        for (const t of tokens) {
          doc.spec.spacing[t.name] = t.value;
        }
        break;
      }
      case "radius": {
        const tokens = extractRadiusTokens(dataRows, mapping, lineOffset);
        doc.spec.radiusTokens = [...(doc.spec.radiusTokens ?? []), ...tokens];
        for (const t of tokens) {
          doc.spec.radii[t.name] = t.value;
        }
        break;
      }
      case "surface": {
        const tokens = extractSurfaceTokens(dataRows, mapping, lineOffset);
        doc.spec.surfaceTokens = [...(doc.spec.surfaceTokens ?? []), ...tokens];
        break;
      }
      case "elevation": {
        const tokens = extractElevationTokens(dataRows, mapping, lineOffset);
        doc.spec.elevationTokens = [
          ...(doc.spec.elevationTokens ?? []),
          ...tokens,
        ];
        break;
      }
      case "layout": {
        const tokens = extractLayoutTokens(dataRows, mapping, lineOffset);
        doc.spec.layoutTokens = [...(doc.spec.layoutTokens ?? []), ...tokens];
        for (const t of tokens) {
          doc.spec.layout[t.name] = t.value;
        }
        break;
      }
      case "component": {
        const recipes = extractComponentRecipes(dataRows, mapping, lineOffset, headerRow);
        doc.spec.componentRecipes = [
          ...(doc.spec.componentRecipes ?? []),
          ...recipes,
        ];
        break;
      }
    }
  });
}

/**
 * Run the table extractor on a raw content string, returning a DesignDocument.
 *
 * Convenience wrapper for use outside the pipeline.
 */
export function extractTablesFromContent(content: string): DesignDocument {
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

  extractTables(doc);
  return doc;
}
