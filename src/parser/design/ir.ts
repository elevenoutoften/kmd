/**
 * Design Mode IR — typed intermediate representation for the design pipeline.
 *
 * Every token carries provenance so downstream stages and the UI can trace
 * values back to the source extractor and line.
 */

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export interface Provenance {
  /** Name of the extractor that produced this token. */
  extractor: string;
  /** Byte range in the original source, if known. */
  sourceRange?: { start: number; end: number };
  /** 1-indexed line in the original source, if known. */
  sourceLine?: number;
}

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export type ColorRole =
  | "brand"
  | "accent"
  | "surface"
  | "background"
  | "text"
  | "text-muted"
  | "divider"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "other";

export type ColorGroup =
  | "Brand"
  | "Neutrals"
  | "Surface"
  | "Semantic"
  | "Other";

export interface ColorToken {
  name: string;
  value: string;
  provenance: Provenance;
  description?: string;
  /** Semantic role inferred by enrichment stage. */
  role?: ColorRole;
  /** Color group inferred by enrichment stage. */
  group?: ColorGroup;
  /** Name of the paired color token (light/dark variant). */
  pair?: string;
}

export interface TypographyToken {
  name: string;
  value: string;
  provenance: Provenance;
  description?: string;
}

export interface SpacingToken {
  name: string;
  value: string;
  provenance: Provenance;
  description?: string;
}

export interface RadiusToken {
  name: string;
  value: string;
  provenance: Provenance;
  description?: string;
}

export interface ElevationToken {
  name: string;
  value: string;
  provenance: Provenance;
  description?: string;
}

export interface SurfaceToken {
  name: string;
  value: string;
  provenance: Provenance;
  description?: string;
}

export interface LayoutToken {
  name: string;
  value: string;
  provenance: Provenance;
  description?: string;
}

export interface ComponentRecipe {
  name: string;
  properties: Record<string, string>;
  provenance: Provenance;
}

export interface GradientToken {
  name: string;
  /** Raw gradient string, e.g. "linear-gradient(135deg, #D946EF 0%, #22D3EE 100%)" */
  value: string;
  /** Parsed stops, if extraction could parse them. */
  stops?: Array<{ color: string; position?: string }>;
  provenance: Provenance;
  description?: string;
}

export interface MotionToken {
  name: string;
  /** e.g. "200ms" */
  duration: string;
  /** e.g. "ease-out" */
  easing: string;
  /** Optional delay, e.g. "50ms" */
  delay?: string;
  provenance: Provenance;
}

export interface BreakpointToken {
  name: string;
  /** e.g. "768px" */
  value: string;
  provenance: Provenance;
}

export interface IconSetHint {
  name: string;
  /** URL or identifier for the icon library, e.g. "lucide", "heroicons" */
  library?: string;
  /** URL to the icon set documentation or CDN */
  url?: string;
  provenance: Provenance;
}

// ---------------------------------------------------------------------------
// DesignSpec (legacy-compatible, extended with IR tokens)
// ---------------------------------------------------------------------------

/**
 * Normalised design spec produced by the pipeline.
 *
 * Maintains the flat-record shape used by the reader UI while adding the richer
 * IR token arrays that later pipeline stages will populate.
 */
export interface DesignSpec {
  colors: Record<string, string>;
  typography: Record<string, string>;
  typographyDetails?: Record<string, Record<string, string>>;
  spacing: Record<string, string>;
  radii: Record<string, string>;
  layout: Record<string, string>;
  raw: Record<string, Record<string, unknown>>;
  /** Unrecognised CSS custom properties from CSS extractor. */
  unknown?: Record<string, string>;

  /** IR-level typed tokens — populated by extractors. */
  colorTokens?: ColorToken[];
  typographyTokens?: TypographyToken[];
  spacingTokens?: SpacingToken[];
  radiusTokens?: RadiusToken[];
  elevationTokens?: ElevationToken[];
  surfaceTokens?: SurfaceToken[];
  layoutTokens?: LayoutToken[];
  componentRecipes?: ComponentRecipe[];
  gradientTokens?: GradientToken[];
  motionTokens?: MotionToken[];
  breakpointTokens?: BreakpointToken[];
  iconSetHints?: IconSetHint[];
  dtcgAliases?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  token?: string;
  message: string;
  /** Rule name that produced this diagnostic (e.g. "broken-ref", "invalid-color"). */
  rule?: string;
  sourceLine?: number;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export interface DetectionResult {
  /** 0–1 confidence score that the input is a design document. */
  score: number;
  /** Human-readable signals that contributed to the score. */
  signals: string[];
}

// ---------------------------------------------------------------------------
// DesignDocument — top-level pipeline output
// ---------------------------------------------------------------------------
export interface DesignDocument {
  spec: DesignSpec;
  diagnostics: Diagnostic[];
  detection: DetectionResult;
  meta: {
    name: string;
    description: string;
    sourceLength: number;
  };
  _sourceContent: string;
}

// ---------------------------------------------------------------------------
// Helpers for creating empty/default structures
// ---------------------------------------------------------------------------

export function emptyProvenance(extractor: string): Provenance {
  return { extractor };
}

export function emptyDesignSpec(): DesignSpec {
  return {
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
    motionTokens: [],
    breakpointTokens: [],
    iconSetHints: [],
  };
}

export function emptyDesignDocument(content: string): DesignDocument {
  return {
    spec: emptyDesignSpec(),
    diagnostics: [],
    detection: { score: 0, signals: [] },
    meta: { name: "", description: "", sourceLength: content.length },
    _sourceContent: content,
  };
}
