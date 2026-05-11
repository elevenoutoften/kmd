/**
 * Design pipeline merge stage.
 *
 * Consolidates tokens from multiple extractors into a single authoritative
 * set per token type, applying deterministic extractor precedence.
 *
 * After `stageExtract` runs, `doc.spec.*Tokens` arrays may contain duplicate
 * token names from different extractors (e.g. yaml, table, css all producing
 * `--color-canvas`).  `mergeDesignDoc` deduplicates by name, keeps the
 * highest-precedence value, and emits conflict diagnostics when extractors
 * disagree.
 *
 * The merge is also exposed as `mergeSpecs` for testing: it takes an array
 * of partial specs and returns a merged spec.
 */

import type {
  ColorToken,
  TypographyToken,
  SpacingToken,
  RadiusToken,
  ElevationToken,
  SurfaceToken,
  LayoutToken,
  ComponentRecipe,
  GradientToken,
  MotionToken,
  BreakpointToken,
  IconSetHint,
  DesignSpec,
  DesignDocument,
  Diagnostic,
  Provenance,
} from "./ir";


// ---------------------------------------------------------------------------
// Extractor precedence (highest → lowest)
// ---------------------------------------------------------------------------

/**
 * Deterministic extractor precedence for conflict resolution.
 *
 * Higher index = higher precedence.  When two extractors provide the same
 * token name, the one with higher precedence wins.
 */
export const EXTRACTOR_PRECEDENCE: readonly string[] = [
  "layout",
  "surface",
  "gradient",
  "shadow",
  "components",
  "prose",
  "css",
  "table",
  "iconSet",
  "breakpoint",
  "motion",
  "figma",
  "styleDictionary",
  "dtcg",
  "yaml",
];

/**
 * Map extractor name → numeric precedence (higher = wins).
 * Built once from `EXTRACTOR_PRECEDENCE`.
 */
const PRECEDENCE_MAP: ReadonlyMap<string, number> = new Map(
  EXTRACTOR_PRECEDENCE.map((name, idx) => [name, idx]),
);

/**
 * Return the numeric precedence for an extractor name.
 * Unknown extractors get precedence -1 (lower than any listed extractor).
 */
function precedenceOf(extractor: string): number {
  return PRECEDENCE_MAP.get(extractor) ?? -1;
}

// ---------------------------------------------------------------------------
// Value normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a token value for comparison purposes.
 *
 * Trims whitespace, collapses internal whitespace to single spaces, and
 * lowercases.  This ensures that `#FFFFFF` and `#ffffff` are treated as
 * the same value, and whitespace differences don't trigger false conflicts.
 */
function normalizeValue(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

// ---------------------------------------------------------------------------
// Named token — minimal interface shared by all IR token types
// ---------------------------------------------------------------------------

interface NamedToken {
  name: string;
  value: string;
  provenance: Provenance;
}

// ---------------------------------------------------------------------------
// Core merge algorithm
// ---------------------------------------------------------------------------

/**
 * Merge an array of named tokens by `name`, applying extractor precedence.
 *
 * Returns the deduplicated token array and any conflict diagnostics.
 */
function mergeTokenArray<T extends NamedToken>(
  tokens: readonly T[],
): { merged: T[]; conflicts: Diagnostic[] } {
  const conflicts: Diagnostic[] = [];

  // Group by name
  const byName = new Map<string, T[]>();
  for (const t of tokens) {
    const existing = byName.get(t.name);
    if (existing) {
      existing.push(t);
    } else {
      byName.set(t.name, [t]);
    }
  }

  const merged: T[] = [];

  for (const [, group] of byName) {
    if (group.length === 1) {
      merged.push(group[0]!);
      continue;
    }

    // Sort by precedence descending, then by source line ascending as tiebreaker.
    // This ensures deterministic selection even when precedence is equal.
    const sorted = [...group].sort(
      (a, b) => {
        const precDiff =
          precedenceOf(b.provenance.extractor) -
          precedenceOf(a.provenance.extractor);
        if (precDiff !== 0) return precDiff;
        // Same precedence: lower source line wins (earlier in document).
        // Tokens without source lines are treated as Infinity (lose).
        const aLine = a.provenance.sourceLine ?? Infinity;
        const bLine = b.provenance.sourceLine ?? Infinity;
        return aLine - bLine;
      },
    );

    // The winner is the highest-precedence token
    const winner = sorted[0]!;
    merged.push(winner);

    // Emit conflicts for every other value that differs
    const winnerNorm = normalizeValue(winner.value);

    for (let i = 1; i < sorted.length; i++) {
      const loser = sorted[i]!;
      const loserNorm = normalizeValue(loser.value);

      if (winnerNorm !== loserNorm) {
        conflicts.push({
          severity: "warning",
          token: winner.name,
          message: formatConflict(winner.name, winner, loser),
        });
      }
    }
  }

  return { merged, conflicts };
}

/**
 * Format a conflict diagnostic message.
 */
function formatConflict(
  tokenName: string,
  winner: NamedToken,
  loser: NamedToken,
): string {
  const wProv = winner.provenance;
  const lProv = loser.provenance;
  const wLine = wProv.sourceLine != null ? ` (line ${wProv.sourceLine})` : "";
  const lLine = lProv.sourceLine != null ? ` (line ${lProv.sourceLine})` : "";

  return (
    `Token "${tokenName}" has conflicting values: ` +
    `${wProv.extractor}${wLine} provides "${winner.value}", ` +
    `${lProv.extractor}${lLine} provides "${loser.value}"`
  );
}

// ---------------------------------------------------------------------------
// Flat-map merge
// ---------------------------------------------------------------------------

/**
 * Merge a flat `Record<string, string>` map using extractor precedence.
 *
 * Each token in `allTokens` may have been contributed by a different
 * extractor.  For a given key, the highest-precedence extractor wins.
 */
function mergeFlatMap(
  allTokens: readonly NamedToken[],
  existing: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = { ...existing };

  // Use the merged token array to get the authoritative values
  const { merged } = mergeTokenArray(allTokens);
  for (const t of merged) {
    result[t.name] = t.value;
  }

  return result;
}

// ---------------------------------------------------------------------------
// ComponentRecipe merge (keyed by name, properties merged)
// ---------------------------------------------------------------------------

function mergeComponentRecipes(
  recipes: readonly ComponentRecipe[],
): { merged: ComponentRecipe[]; conflicts: Diagnostic[] } {
  const conflicts: Diagnostic[] = [];

  const byName = new Map<string, ComponentRecipe[]>();
  for (const r of recipes) {
    const existing = byName.get(r.name);
    if (existing) {
      existing.push(r);
    } else {
      byName.set(r.name, [r]);
    }
  }

  const merged: ComponentRecipe[] = [];

  for (const [, group] of byName) {
    if (group.length === 1) {
      merged.push(group[0]!);
      continue;
    }

    // Sort by precedence descending
    const sorted = [...group].sort(
      (a, b) =>
        precedenceOf(b.provenance.extractor) -
        precedenceOf(a.provenance.extractor),
    );

    // Winner properties take precedence, but merge all properties
    const props: Record<string, string> = {};
    // Apply from lowest to highest precedence so higher overwrites
    for (let i = sorted.length - 1; i >= 0; i--) {
      Object.assign(props, sorted[i]!.properties);
    }

    merged.push({
      name: sorted[0]!.name,
      properties: props,
      provenance: sorted[0]!.provenance,
    });

    // Check for property-level conflicts
    const winner = sorted[0]!;
    for (let i = 1; i < sorted.length; i++) {
      const loser = sorted[i]!;
      for (const [key, loserVal] of Object.entries(loser.properties)) {
        const winnerVal = winner.properties[key];
        if (
          winnerVal != null &&
          normalizeValue(winnerVal) !== normalizeValue(loserVal)
        ) {
          const wLine =
            winner.provenance.sourceLine != null
              ? ` (line ${winner.provenance.sourceLine})`
              : "";
          const lLine =
            loser.provenance.sourceLine != null
              ? ` (line ${loser.provenance.sourceLine})`
              : "";
          conflicts.push({
            severity: "warning",
            token: `${winner.name}.${key}`,
            message:
              `Component "${winner.name}" property "${key}" has conflicting values: ` +
              `${winner.provenance.extractor}${wLine} provides "${winnerVal}", ` +
              `${loser.provenance.extractor}${lLine} provides "${loserVal}"`,
          });
        }
      }
    }
  }

  return { merged, conflicts };
}

// ---------------------------------------------------------------------------
// GradientToken merge
// ---------------------------------------------------------------------------

function mergeGradientTokens(
  tokens: readonly GradientToken[],
): { merged: GradientToken[]; conflicts: Diagnostic[] } {
  // GradientToken has `value` and optional `stops` — use value as the
  // comparison key
  return mergeTokenArray(tokens as readonly NamedToken[]) as {
    merged: GradientToken[];
    conflicts: Diagnostic[];
  };
}

function mergeIconSetHints(
  hints: readonly IconSetHint[],
): { merged: IconSetHint[]; conflicts: Diagnostic[] } {
  const byName = new Map<string, IconSetHint[]>();
  for (const hint of hints) {
    const key = hint.name.toLowerCase();
    const existing = byName.get(key);
    if (existing) existing.push(hint);
    else byName.set(key, [hint]);
  }

  const merged: IconSetHint[] = [];
  for (const group of byName.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        precedenceOf(b.provenance.extractor) -
        precedenceOf(a.provenance.extractor),
    );
    merged.push(sorted[0]!);
  }

  return { merged, conflicts: [] };
}

// ---------------------------------------------------------------------------
// Public API: mergeSpecs
// ---------------------------------------------------------------------------

/**
 * Merge multiple partial `DesignSpec` objects into a single authoritative spec.
 *
 * Token arrays from each partial are concatenated and deduplicated by name
 * using `EXTRACTOR_PRECEDENCE`.  Flat maps (`colors`, `spacing`, etc.) are
 * rebuilt from the merged tokens so they reflect the winning values.
 *
 * Returns `{ spec, diagnostics }`.
 */
export function mergeSpecs(partials: readonly DesignSpec[]): {
  spec: DesignSpec;
  diagnostics: Diagnostic[];
} {
  const allColorTokens: ColorToken[] = [];
  const allTypographyTokens: TypographyToken[] = [];
  const allSpacingTokens: SpacingToken[] = [];
  const allRadiusTokens: RadiusToken[] = [];
  const allElevationTokens: ElevationToken[] = [];
  const allSurfaceTokens: SurfaceToken[] = [];
  const allLayoutTokens: LayoutToken[] = [];
  const allComponentRecipes: ComponentRecipe[] = [];
  const allGradientTokens: GradientToken[] = [];
  const allMotionTokens: MotionToken[] = [];
  const allBreakpointTokens: BreakpointToken[] = [];
  const allIconSetHints: IconSetHint[] = [];
  const allDiagnostics: Diagnostic[] = [];

  // Collect raw flat maps for keys not represented in token arrays
  const flatColors: Record<string, string> = {};
  const flatTypography: Record<string, string> = {};
  const flatSpacing: Record<string, string> = {};
  const flatRadii: Record<string, string> = {};
  const flatLayout: Record<string, string> = {};

  for (const partial of partials) {
    if (partial.colorTokens) allColorTokens.push(...partial.colorTokens);
    if (partial.typographyTokens)
      allTypographyTokens.push(...partial.typographyTokens);
    if (partial.spacingTokens) allSpacingTokens.push(...partial.spacingTokens);
    if (partial.radiusTokens) allRadiusTokens.push(...partial.radiusTokens);
    if (partial.elevationTokens)
      allElevationTokens.push(...partial.elevationTokens);
    if (partial.surfaceTokens) allSurfaceTokens.push(...partial.surfaceTokens);
    if (partial.layoutTokens) allLayoutTokens.push(...partial.layoutTokens);
    if (partial.componentRecipes)
      allComponentRecipes.push(...partial.componentRecipes);
    if (partial.gradientTokens)
      allGradientTokens.push(...partial.gradientTokens);
    if (partial.motionTokens) allMotionTokens.push(...partial.motionTokens);
    if (partial.breakpointTokens)
      allBreakpointTokens.push(...partial.breakpointTokens);
    if (partial.iconSetHints) allIconSetHints.push(...partial.iconSetHints);

    // Merge flat maps — last-writer-wins across partials (within a partial,
    // the extractor already set the value)
    Object.assign(flatColors, partial.colors);
    Object.assign(flatTypography, partial.typography);
    Object.assign(flatSpacing, partial.spacing);
    Object.assign(flatRadii, partial.radii);
    Object.assign(flatLayout, partial.layout);
  }

  // Merge each token array
  const colorResult = mergeTokenArray(allColorTokens);
  const typoResult = mergeTokenArray(allTypographyTokens);
  const spacingResult = mergeTokenArray(allSpacingTokens);
  const radiusResult = mergeTokenArray(allRadiusTokens);
  const elevationResult = mergeTokenArray(allElevationTokens);
  const surfaceResult = mergeTokenArray(allSurfaceTokens);
  const layoutResult = mergeTokenArray(allLayoutTokens);
  const componentResult = mergeComponentRecipes(allComponentRecipes);
  const gradientResult = mergeGradientTokens(allGradientTokens);
  const motionResult = mergeTokenArray(
    allMotionTokens.map((token) => ({
      ...token,
      value: [token.duration, token.easing, token.delay].filter(Boolean).join(" "),
    })),
  ) as { merged: Array<MotionToken & { value: string }>; conflicts: Diagnostic[] };
  const breakpointResult = mergeTokenArray(allBreakpointTokens);
  const iconSetResult = mergeIconSetHints(allIconSetHints);

  allDiagnostics.push(
    ...colorResult.conflicts,
    ...typoResult.conflicts,
    ...spacingResult.conflicts,
    ...radiusResult.conflicts,
    ...elevationResult.conflicts,
    ...surfaceResult.conflicts,
    ...layoutResult.conflicts,
    ...componentResult.conflicts,
    ...gradientResult.conflicts,
    ...motionResult.conflicts,
    ...breakpointResult.conflicts,
    ...iconSetResult.conflicts,
  );

  // Rebuild flat maps from merged tokens (merged tokens are authoritative)
  const spec: DesignSpec = {
    colors: mergeFlatMap(allColorTokens, flatColors),
    typography: mergeFlatMap(allTypographyTokens, flatTypography),
    spacing: mergeFlatMap(allSpacingTokens, flatSpacing),
    radii: mergeFlatMap(allRadiusTokens, flatRadii),
    layout: mergeFlatMap(allLayoutTokens, flatLayout),
    raw: {},
    colorTokens: colorResult.merged,
    typographyTokens: typoResult.merged,
    spacingTokens: spacingResult.merged,
    radiusTokens: radiusResult.merged,
    elevationTokens: elevationResult.merged,
    surfaceTokens: surfaceResult.merged,
    layoutTokens: layoutResult.merged,
    componentRecipes: componentResult.merged,
    gradientTokens: gradientResult.merged,
    motionTokens: motionResult.merged.map(({ value: _value, ...token }) => token),
    breakpointTokens: breakpointResult.merged,
    iconSetHints: iconSetResult.merged,
  };

  return { spec, diagnostics: allDiagnostics };
}

// ---------------------------------------------------------------------------
// Pipeline stage: stageMerge
// ---------------------------------------------------------------------------

/**
 * Pipeline stage that merges all extracted tokens into an authoritative set.
 *
 * Operates on the `DesignDocument` in place (pipeline convention).
 * After all extractors have populated `doc.spec.*Tokens` arrays, this stage:
 *
 * 1. Calls `mergeSpecs([doc.spec])` to deduplicate and resolve conflicts.
 * 2. Replaces the token arrays and flat maps with the merged results.
 * 3. Appends conflict diagnostics to `doc.diagnostics`.
 */
export function stageMerge(doc: DesignDocument): void {
  const { spec, diagnostics } = mergeSpecs([doc.spec]);

  // Replace token arrays
  doc.spec.colorTokens = spec.colorTokens;
  doc.spec.typographyTokens = spec.typographyTokens;
  doc.spec.spacingTokens = spec.spacingTokens;
  doc.spec.radiusTokens = spec.radiusTokens;
  doc.spec.elevationTokens = spec.elevationTokens;
  doc.spec.surfaceTokens = spec.surfaceTokens;
  doc.spec.layoutTokens = spec.layoutTokens;
  doc.spec.componentRecipes = spec.componentRecipes;
  doc.spec.gradientTokens = spec.gradientTokens;
  doc.spec.motionTokens = spec.motionTokens;
  doc.spec.breakpointTokens = spec.breakpointTokens;
  doc.spec.iconSetHints = spec.iconSetHints;

  // Replace flat maps
  doc.spec.colors = spec.colors;
  doc.spec.typography = spec.typography;
  doc.spec.spacing = spec.spacing;
  doc.spec.radii = spec.radii;
  doc.spec.layout = spec.layout;

  // Append merge diagnostics (conflicts)
  doc.diagnostics.push(...diagnostics);
}
