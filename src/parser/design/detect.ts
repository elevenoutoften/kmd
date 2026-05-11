import { EXTRACTORS } from "./extractors";
import { stageMerge } from "./merge";
import { scoreCheapSignals, type Signal, type DetectionOutput } from "./detectCheap";
import type { StageFn } from "./pipeline";
import type { DesignDocument } from "./ir";
import { emptyDesignDocument } from "./ir";

export type { Signal, DetectionOutput };
export { detectDesignDocumentCheap } from "./detectCheap";

function scoreTokenSignals(doc: DesignDocument, signals: Signal[]): void {
  const colorCount = doc.spec.colorTokens?.length ?? 0;
  if (colorCount >= 3) {
    signals.push({
      signal: `>=3 color tokens (${colorCount})`,
      points: 3,
    });
  }

  const typoCount = doc.spec.typographyTokens?.length ?? 0;
  if (typoCount >= 3) {
    signals.push({
      signal: `>=3 typography tokens (${typoCount})`,
      points: 2,
    });
  }
}

const DETECT_STAGES: StageFn[] = [...EXTRACTORS, stageMerge];

function runDetectPipeline(content: string): DesignDocument {
  const doc = emptyDesignDocument(content);

  for (const stage of DETECT_STAGES) {
    try {
      stage(doc);
    } catch {
      // Swallow errors — detection is best-effort.
    }
  }
  return doc;
}

export function detectDesignDocument(
  content: string,
  filename?: string,
): DetectionOutput {
  const signals: Signal[] = [];

  scoreCheapSignals(content, filename, signals);

  const doc = runDetectPipeline(content);
  scoreTokenSignals(doc, signals);

  const score = signals.reduce((sum, s) => sum + s.points, 0);
  return { score, signals, threshold: 5 };
}

export function stageDetectInPipeline(doc: DesignDocument): void {
  const source = doc._sourceContent;
  if (!source) return;

  const signals: Signal[] = [];
  scoreCheapSignals(source, undefined, signals);

  const rawScore = signals.reduce((sum, s) => sum + s.points, 0);

  const normalizedScore = Math.min(rawScore / 10, 1);

  doc.detection = {
    score: normalizedScore,
    signals: signals.map((s) => `${s.signal} (+${s.points})`),
  };

  const firstHeading = source.match(/^#\s+(.+)$/m);
  if (firstHeading) {
    doc.meta.name = firstHeading[1]!.trim();
  }

  const lines = source.split("\n");
  for (const line of lines.slice(1, 10)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    doc.meta.description = trimmed;
    break;
  }
}
