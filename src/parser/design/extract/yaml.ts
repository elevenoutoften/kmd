/**
 * YAML frontmatter extractor for the design pipeline.
 *
 * Splits YAML frontmatter from raw content, parses it with `js-yaml`, and
 * populates the typed IR token arrays on the DesignDocument.  Nested objects
 * (e.g. typography entries with sub-properties) are preserved as objects —
 * they are **not** flattened to comma-joined strings.
 *
 * Reference strings (`{group.name}`, `{name}`, `var(--name)`) are kept
 * verbatim in token values; resolution is a later pipeline stage.
 */

import * as yaml from "js-yaml";
import type {
  ColorToken,
  TypographyToken,
  SpacingToken,
  RadiusToken,
  LayoutToken,
  ComponentRecipe,
  DesignDocument,
  Provenance,
} from "../ir";

// ---------------------------------------------------------------------------
// Frontmatter splitting
// ---------------------------------------------------------------------------

export interface FrontMatterResult {
  /** Extracted YAML frontmatter string (without delimiters), or empty string. */
  frontmatter: string;
  /** Remaining body content after the frontmatter. */
  body: string;
  /** 1-indexed line offset where the body starts (for provenance). */
  bodyLineOffset: number;
}

const YAML_DELIMITER = "---";

/**
 * Split `---`-delimited YAML frontmatter from content.
 *
 * Supports both `---\nyaml\n---\nbody` and bare content without frontmatter.
 */
export function splitYamlFrontMatter(content: string): FrontMatterResult {
  if (!content.startsWith(YAML_DELIMITER)) {
    return { frontmatter: "", body: content, bodyLineOffset: 1 };
  }

  // Find the closing --- delimiter.  It must appear at the start of a line.
  const afterFirst = content.length > 3 ? content.indexOf("\n", 3) : -1;
  if (afterFirst === -1) {
    return { frontmatter: "", body: content, bodyLineOffset: 1 };
  }

  // Scan for closing --- on its own line.
  const searchFrom = afterFirst + 1;
  const closeIdx = content.indexOf("\n---", searchFrom);

  if (closeIdx === -1) {
    // No closing delimiter — treat as no frontmatter.
    return { frontmatter: "", body: content, bodyLineOffset: 1 };
  }

  // Verify the closing --- is at line start (preceded by \n or is at pos 0).
  const frontmatter = content.slice(afterFirst + 1, closeIdx);
  const bodyStart = closeIdx + 4 + 1; // skip \n---\n
  const body = content.slice(Math.min(bodyStart, content.length));

  // Count lines in frontmatter + 2 delimiters for provenance offset.
  const linesBefore = 2; // opening ---\n + \n---
  const frontmatterLines = frontmatter.split("\n").length;
  const bodyLineOffset = linesBefore + frontmatterLines;

  return { frontmatter, body, bodyLineOffset };
}

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

/** Mapping from YAML top-level key to the IR token category it produces. */
const CATEGORY_MAP: Record<string, string> = {
  colors: "color",
  typography: "typography",
  spacing: "spacing",
  radii: "radius",
  rounded: "radius", // alias used in some specs
  layout: "layout",
  components: "component",
  elevation: "elevation",
  surfaces: "surface",
};

// ---------------------------------------------------------------------------
// Provenance helper
// ---------------------------------------------------------------------------

function makeProvenance(lineOffset: number, keyIndex: number): Provenance {
  return {
    extractor: "yaml",
    sourceLine: lineOffset + keyIndex,
  };
}

// ---------------------------------------------------------------------------
// Token builders
// ---------------------------------------------------------------------------

function buildColorTokens(
  raw: Record<string, unknown>,
  lineOffset: number,
): ColorToken[] {
  const tokens: ColorToken[] = [];
  const entries = Object.entries(raw);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const [name, value] = entry;
    tokens.push({
      name,
      value: String(value),
      provenance: makeProvenance(lineOffset, i),
    });
  }
  return tokens;
}

function buildTypographyTokens(
  raw: Record<string, unknown>,
  lineOffset: number,
): TypographyToken[] {
  const tokens: TypographyToken[] = [];
  const entries = Object.entries(raw);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const [name, value] = entry;
    // Preserve nested objects as-is via JSON; store primitives as strings.
    const serialized =
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : String(value);
    tokens.push({
      name,
      value: serialized,
      provenance: makeProvenance(lineOffset, i),
    });
  }
  return tokens;
}

function buildSpacingTokens(
  raw: Record<string, unknown>,
  lineOffset: number,
): SpacingToken[] {
  const tokens: SpacingToken[] = [];
  const entries = Object.entries(raw);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const [name, value] = entry;
    tokens.push({
      name,
      value: String(value),
      provenance: makeProvenance(lineOffset, i),
    });
  }
  return tokens;
}

function buildRadiusTokens(
  raw: Record<string, unknown>,
  lineOffset: number,
): RadiusToken[] {
  const tokens: RadiusToken[] = [];
  const entries = Object.entries(raw);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const [name, value] = entry;
    tokens.push({
      name,
      value: String(value),
      provenance: makeProvenance(lineOffset, i),
    });
  }
  return tokens;
}

function buildLayoutTokens(
  raw: Record<string, unknown>,
  lineOffset: number,
): LayoutToken[] {
  const tokens: LayoutToken[] = [];
  const entries = Object.entries(raw);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const [name, value] = entry;
    tokens.push({
      name,
      value: String(value),
      provenance: makeProvenance(lineOffset, i),
    });
  }
  return tokens;
}

function buildComponentRecipes(
  raw: Record<string, unknown>,
  lineOffset: number,
): ComponentRecipe[] {
  const recipes: ComponentRecipe[] = [];
  const entries = Object.entries(raw);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const [name, value] = entry;
    const props: Record<string, string> = {};
    if (typeof value === "object" && value !== null) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        props[k] = String(v);
      }
    } else {
      props.value = String(value);
    }
    recipes.push({
      name,
      properties: props,
      provenance: makeProvenance(lineOffset, i),
    });
  }
  return recipes;
}

// ---------------------------------------------------------------------------
// Line-offset computation for a top-level YAML key
// ---------------------------------------------------------------------------

/**
 * Compute the approximate line offset for a top-level key within frontmatter.
 * YAML keys appear at the start of a line; we scan for `key:` at line starts.
 */
function keyLineOffset(frontmatter: string, key: string): number {
  const lines = frontmatter.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trimStart();
    if (trimmed.startsWith(key + ":")) {
      return i;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract design tokens from YAML frontmatter and populate the
 * `DesignDocument` IR token arrays.
 *
 * Mutates `doc` in place (pipeline convention).  On parse failure, appends
 * a diagnostic and returns without populating tokens.
 */
export function extractYaml(doc: DesignDocument): void {
  const source = doc._sourceContent;
  if (!source) {
    // No source content — nothing to extract.
    return;
  }

  const { frontmatter, bodyLineOffset } = splitYamlFrontMatter(source);
  if (!frontmatter.trim()) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(frontmatter);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    doc.diagnostics.push({
      severity: "error",
      token: "",
      message: `YAML parse error: ${message}`,
    });
    return;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return;
  }

  const root = parsed as Record<string, unknown>;
  const fm = frontmatter; // capture for closure

  // Compute line offsets per key.
  function offsetForKey(key: string): number {
    return bodyLineOffset + keyLineOffset(fm, key);
  }

  // Populate raw with original parsed data (preserving nested objects).
  doc.spec.raw = {};
  for (const [key, value] of Object.entries(root)) {
    if (typeof value === "object" && value !== null) {
      doc.spec.raw[key] = value as Record<string, string>;
    }
  }

  // Populate typed token arrays and legacy-compatible flat maps.
  for (const [yamlKey, category] of Object.entries(CATEGORY_MAP)) {
    const value = root[yamlKey];
    if (typeof value !== "object" || value === null) continue;

    const map = value as Record<string, unknown>;
    const offset = offsetForKey(yamlKey);

    switch (category) {
      case "color": {
        doc.spec.colorTokens = buildColorTokens(map, offset);
        // Legacy flat map — scalar values only.
        for (const [k, v] of Object.entries(map)) {
          doc.spec.colors[k] = String(v);
        }
        break;
      }
      case "typography": {
        doc.spec.typographyTokens = buildTypographyTokens(map, offset);
        break;
      }
      case "spacing": {
        doc.spec.spacingTokens = buildSpacingTokens(map, offset);
        for (const [k, v] of Object.entries(map)) {
          doc.spec.spacing[k] = String(v);
        }
        break;
      }
      case "radius": {
        // Merge into a single array if both "radii" and "rounded" exist.
        const existing = doc.spec.radiusTokens ?? [];
        const more = buildRadiusTokens(map, offset);
        doc.spec.radiusTokens = [...existing, ...more];
        for (const [k, v] of Object.entries(map)) {
          doc.spec.radii[k] = String(v);
        }
        break;
      }
      case "layout": {
        doc.spec.layoutTokens = buildLayoutTokens(map, offset);
        for (const [k, v] of Object.entries(map)) {
          doc.spec.layout[k] = String(v);
        }
        break;
      }
      case "component": {
        doc.spec.componentRecipes = buildComponentRecipes(map, offset);
        break;
      }
      case "elevation": {
        // Store in raw for now; typed elevation tokens can be added later.
        doc.spec.elevationTokens = buildSpacingTokens(map, offset).map(
          (t) => ({
            name: t.name,
            value: t.value,
            provenance: t.provenance,
          }),
        );
        break;
      }
      case "surface": {
        // Store in raw for now.
        doc.spec.surfaceTokens = buildSpacingTokens(map, offset).map(
          (t) => ({
            name: t.name,
            value: t.value,
            provenance: t.provenance,
          }),
        );
        break;
      }
    }
  }
}

/**
 * Run the YAML extractor on a raw content string, returning a DesignDocument.
 *
 * Convenience wrapper for use outside the pipeline.
 */
export function extractYamlFromContent(content: string): DesignDocument {
  // Minimal DesignDocument — matches pipeline.ts construction.
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

  extractYaml(doc);
  return doc;
}
