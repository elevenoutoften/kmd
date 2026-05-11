import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { runDesignPipeline } from "./pipeline";
import type { DesignDocument, Provenance } from "./ir";

const FIXTURE_DIR = join(__dirname, "../../../fixtures/design-mode");

const loadFixture = (name: string) =>
  readFileSync(join(FIXTURE_DIR, name), "utf-8");

type SnapshotToken = {
  name: string;
  value: string | Record<string, string>;
  extractor: string;
};

type TokenWithProvenance = {
  name: string;
  value?: string;
  properties?: Record<string, string>;
  provenance: Provenance;
};

const tokenCategories = {
  colors: "colorTokens",
  typography: "typographyTokens",
  spacing: "spacingTokens",
  radii: "radiusTokens",
  layout: "layoutTokens",
  elevation: "elevationTokens",
  surface: "surfaceTokens",
  components: "componentRecipes",
} as const;

function summarizeTokens(tokens: TokenWithProvenance[]): SnapshotToken[] {
  return tokens.slice(0, 3).map((token) => ({
    name: token.name,
    value: token.value ?? token.properties ?? {},
    extractor: token.provenance.extractor,
  }));
}

function countDiagnostics(doc: DesignDocument): Record<"error" | "warning" | "info", number> {
  return doc.diagnostics.reduce(
    (counts, diagnostic) => {
      counts[diagnostic.severity] += 1;
      return counts;
    },
    { error: 0, warning: 0, info: 0 },
  );
}

function buildFixtureSnapshot(doc: DesignDocument) {
  const tokenCounts: Record<keyof typeof tokenCategories, number> = {
    colors: 0,
    typography: 0,
    spacing: 0,
    radii: 0,
    layout: 0,
    elevation: 0,
    surface: 0,
    components: 0,
  };
  const tokenSamples: Partial<Record<keyof typeof tokenCategories, SnapshotToken[]>> = {};

  for (const [category, field] of Object.entries(tokenCategories) as Array<
    [keyof typeof tokenCategories, (typeof tokenCategories)[keyof typeof tokenCategories]]
  >) {
    const tokens = (doc.spec[field] ?? []) as TokenWithProvenance[];
    tokenCounts[category] = tokens.length;

    if (tokens.length > 0) {
      tokenSamples[category] = summarizeTokens(tokens);
    }
  }

  return {
    tokenCounts,
    tokenSamples,
    diagnosticsBySeverity: countDiagnostics(doc),
    detectionScore: doc.detection.score,
  };
}

const fixtures = [
  "apple.md",
  "dylanbrouwer.md",
  "shopvibe.md",
  "synthetic-hybrid.md",
  "synthetic-prose-only.md",
  "synthetic-dtcg.md",
] as const;

describe("runDesignPipeline fixtures", () => {
  for (const fixture of fixtures) {
    describe(`fixture: ${fixture}`, () => {
      it("snapshot matches", () => {
        const doc = runDesignPipeline(loadFixture(fixture));

        expect(buildFixtureSnapshot(doc)).toMatchSnapshot();
      });
    });
  }
});
