/**
 * Design pipeline skeleton.
 *
 * Stage order: Detect → Extract → Merge → Resolve → Enrich
 *
 * Each stage is a pure function that receives a DesignDocument (mutable in
 * place for performance) and may append diagnostics.  An extractor that throws
 * does **not** abort the pipeline — the error is captured as a diagnostic.
 */

import type { DesignDocument, Diagnostic } from "./ir";
import { stageDetectInPipeline } from "./detect";
import { EXTRACTORS } from "./extractors";
import { stageMerge } from "./merge";
import { resolveSpec } from "./resolve";
import { enrichSpec } from "./enrich";

export type StageFn = (doc: DesignDocument) => void;

function stageDetect(doc: DesignDocument): void {
  stageDetectInPipeline(doc);
}

function stageExtract(doc: DesignDocument): void {
  for (const extractor of EXTRACTORS) {
    extractor(doc);
  }
}

const DEFAULT_STAGES: StageFn[] = [
  stageDetect,
  stageExtract,
  stageMerge,
  resolveSpec,
  enrichSpec,
];

/**
 * Run the design pipeline on raw content.
 *
 * Returns a `DesignDocument`.  Each stage runs in order; if a stage throws,
 * the error is captured as a diagnostic and the pipeline continues.
 */
export function runDesignPipeline(
  content: string,
  stages: StageFn[] = DEFAULT_STAGES,
): DesignDocument {
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
      motionTokens: [],
      breakpointTokens: [],
      iconSetHints: [],
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

  for (const stage of stages) {
    try {
      stage(doc);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      const diagnostic: Diagnostic = {
        severity: "error",
        token: "",
        message: `Pipeline stage failed: ${message}`,
      };
      doc.diagnostics.push(diagnostic);
    }
  }

  return doc;
}
