/**
 * Public facade for the design pipeline.
 *
 * Exposes the design pipeline + IR types.
 */

// Extraction utilities (used by parser pipeline)
export { splitYamlFrontMatter } from "./extract/yaml";

// IR types
export type {
  Provenance,
  ColorRole,
  ColorGroup,
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
  Diagnostic,
  DetectionResult,
  DesignSpec,
  DesignDocument,
} from "./ir";
export {
  emptyProvenance,
  emptyDesignSpec,
  emptyDesignDocument,
} from "./ir";

// Pipeline
export { runDesignPipeline, type StageFn } from "./pipeline";
export { clearDesignPipelineCache, runDesignPipelineCached } from "./cache";

// Merge stage
export { mergeSpecs, stageMerge, EXTRACTOR_PRECEDENCE } from "./merge";

// Resolve stage
export { resolveSpec } from "./resolve";

// Enrich stage
export { enrichSpec } from "./enrich";

// Design mode helpers
export {
  hasDesignTokens,
  parseProseDesignSpec,
  summarizeMarkdownForDesignMode,
  type DesignModeSection,
  type DesignModeDocumentSummary,
  type ProseDesignSpec,
} from "./designMode";

// Detection
export { detectDesignDocumentCheap, type Signal, type DetectionOutput } from "./detectCheap";
export { stageDetectInPipeline } from "./detect";
