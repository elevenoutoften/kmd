import { describe, it, expect, beforeAll } from "vitest";
import {
  extractYamlFromContent,
  splitYamlFrontMatter,
} from "./yaml";
import type { DesignDocument } from "../ir";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(name: string): string {
  return readFileSync(
    resolve(__dirname, "../../../../fixtures", name),
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// splitYamlFrontMatter
// ---------------------------------------------------------------------------

describe("splitYamlFrontMatter", () => {
  it("splits YAML frontmatter from content", () => {
    const content = "---\nfoo: bar\n---\nBody text\n";
    const result = splitYamlFrontMatter(content);
    expect(result.frontmatter).toBe("foo: bar");
    expect(result.body).toBe("Body text\n");
  });

  it("returns empty frontmatter when no delimiters", () => {
    const content = "Just body text\nNo frontmatter\n";
    const result = splitYamlFrontMatter(content);
    expect(result.frontmatter).toBe("");
    expect(result.body).toBe(content);
  });

  it("returns empty frontmatter when closing delimiter is missing", () => {
    const content = "---\nfoo: bar\nNo closing delimiter\n";
    const result = splitYamlFrontMatter(content);
    expect(result.frontmatter).toBe("");
    expect(result.body).toBe(content);
  });

  it("computes bodyLineOffset", () => {
    const content = "---\nfoo: bar\nbaz: qux\n---\nBody\n";
    const result = splitYamlFrontMatter(content);
    expect(result.bodyLineOffset).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// extractYamlFromContent — empty / no frontmatter
// ---------------------------------------------------------------------------

describe("extractYaml — no frontmatter", () => {
  it("returns empty spec with no errors for plain content", () => {
    const doc = extractYamlFromContent("Just some markdown\n");
    expect(doc.spec.colorTokens).toEqual([]);
    expect(doc.spec.typographyTokens).toEqual([]);
    expect(doc.diagnostics).toEqual([]);
  });

  it("returns empty spec for empty string", () => {
    const doc = extractYamlFromContent("");
    expect(doc.spec.colorTokens).toEqual([]);
    expect(doc.diagnostics).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractYamlFromContent — apple-DESIGN.md fixture
// ---------------------------------------------------------------------------

describe("extractYaml — apple-DESIGN.md", () => {
  let doc: DesignDocument;

  beforeAll(() => {
    doc = extractYamlFromContent(loadFixture("apple-DESIGN.md"));
  });

  // --- Color tokens ---

  it("extracts 23 color tokens", () => {
    expect(doc.spec.colorTokens).toHaveLength(23);
  });

  it("preserves hex color values verbatim", () => {
    const primary = doc.spec.colorTokens!.find(
      (t) => t.name === "color-primary",
    );
    expect(primary).toBeDefined();
    expect(primary!.value).toBe("#007AFF");
  });

  it("sets provenance extractor to 'yaml'", () => {
    expect(doc.spec.colorTokens![0].provenance.extractor).toBe("yaml");
    expect(doc.spec.colorTokens![0].provenance.sourceLine).toBeGreaterThan(0);
  });

  // --- Typography tokens ---

  it("extracts 16 typography tokens", () => {
    expect(doc.spec.typographyTokens).toHaveLength(16);
  });

  it("preserves nested typography as JSON object (not comma-joined string)", () => {
    const heroDisplay = doc.spec.typographyTokens!.find(
      (t) => t.name === "hero-display",
    );
    expect(heroDisplay).toBeDefined();

    // The value should be parseable JSON with 5 sub-properties.
    const parsed = JSON.parse(heroDisplay!.value);
    expect(parsed).toHaveProperty("font-family");
    expect(parsed).toHaveProperty("font-size");
    expect(parsed).toHaveProperty("font-weight");
    expect(parsed).toHaveProperty("line-height");
    expect(parsed).toHaveProperty("letter-spacing");

    // Verify it's NOT a comma-joined string.
    expect(heroDisplay!.value).not.toMatch(/^[^{}]+,[^{}]+$/);
    // Verify it IS a JSON object.
    expect(typeof parsed).toBe("object");
    expect(Array.isArray(parsed)).toBe(false);
  });

  it("preserves exact font-family value in nested typography", () => {
    const heroDisplay = doc.spec.typographyTokens!.find(
      (t) => t.name === "hero-display",
    );
    const parsed = JSON.parse(heroDisplay!.value);
    expect(parsed["font-family"]).toBe(
      '"SF Pro Display", system-ui, -apple-system, sans-serif',
    );
  });

  // --- Radius tokens ---

  it("extracts 8 radius tokens", () => {
    expect(doc.spec.radiusTokens).toHaveLength(8);
  });

  // --- Spacing tokens ---

  it("extracts 8 spacing tokens", () => {
    expect(doc.spec.spacingTokens).toHaveLength(8);
  });

  // --- Component recipes ---

  it("extracts 22 component recipes", () => {
    expect(doc.spec.componentRecipes).toHaveLength(22);
  });

  it("preserves component reference strings verbatim", () => {
    const buttonPrimary = doc.spec.componentRecipes!.find(
      (r) => r.name === "button-primary",
    );
    expect(buttonPrimary).toBeDefined();
    expect(buttonPrimary!.properties.background).toBe("{colors.primary}");
    expect(buttonPrimary!.properties.radius).toBe("{radii.md}");
    expect(buttonPrimary!.properties.padding).toBe("{spacing.sm} {spacing.lg}");
  });

  // --- Provenance ---

  it("all tokens have provenance with extractor='yaml'", () => {
    const allTokens = [
      ...(doc.spec.colorTokens ?? []),
      ...(doc.spec.typographyTokens ?? []),
      ...(doc.spec.spacingTokens ?? []),
      ...(doc.spec.radiusTokens ?? []),
      ...(doc.spec.layoutTokens ?? []),
    ];
    for (const token of allTokens) {
      expect(token.provenance.extractor).toBe("yaml");
      expect(token.provenance.sourceLine).toBeGreaterThanOrEqual(0);
    }
  });

  // --- Raw ---

  it("populates spec.raw with parsed YAML sections", () => {
    expect(doc.spec.raw).toHaveProperty("colors");
    expect(doc.spec.raw).toHaveProperty("typography");
    expect(doc.spec.raw).toHaveProperty("radii");
    expect(doc.spec.raw).toHaveProperty("spacing");
    expect(doc.spec.raw).toHaveProperty("components");
  });

  it("preserves nested typography in raw as objects", () => {
    const rawTypo = doc.spec.raw.typography as Record<
      string,
      Record<string, string>
    >;
    expect(typeof rawTypo["hero-display"]).toBe("object");
    expect(rawTypo["hero-display"]).not.toBeNull();
    expect(rawTypo["hero-display"]).toHaveProperty("font-family");
    expect(rawTypo["hero-display"]).toHaveProperty("font-size");
  });

  // --- No diagnostics ---

  it("produces no diagnostics for valid fixture", () => {
    expect(doc.diagnostics).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractYamlFromContent — existing design-md-valid.md
// ---------------------------------------------------------------------------

describe("extractYaml — design-md-valid.md", () => {
  let doc: DesignDocument;

  beforeAll(() => {
    const raw = loadFixture("design-md-valid.md");
    doc = extractYamlFromContent(`---\n${raw}---\n`);
  });

  it("extracts color tokens from flat scalar values", () => {
    expect(doc.spec.colorTokens!.length).toBeGreaterThan(0);
    const onSurface = doc.spec.colorTokens!.find(
      (t) => t.name === "color-on-surface",
    );
    expect(onSurface!.value).toBe("#e8eaed");
  });

  it("extracts spacing tokens", () => {
    expect(doc.spec.spacingTokens!.length).toBeGreaterThan(0);
  });

  it("extracts radius tokens", () => {
    expect(doc.spec.radiusTokens!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// extractYamlFromContent — invalid YAML
// ---------------------------------------------------------------------------

describe("extractYaml — malformed YAML", () => {
  it("produces a diagnostic on unparseable YAML", () => {
    const doc = extractYamlFromContent("---\n: [invalid\n: yaml\n---\n");
    expect(doc.diagnostics.length).toBeGreaterThan(0);
    expect(doc.diagnostics[0].severity).toBe("error");
    expect(doc.diagnostics[0].message).toContain("YAML parse error");
  });
});

// ---------------------------------------------------------------------------
// extractYamlFromContent — reference preservation
// ---------------------------------------------------------------------------

describe("extractYaml — reference preservation", () => {
  it("preserves var() references in token values", () => {
    const doc = extractYamlFromContent(
      '---\ncolors:\n  color-missing: "var(--color-undefined)"\n---\n',
    );
    const token = doc.spec.colorTokens!.find(
      (t) => t.name === "color-missing",
    );
    expect(token!.value).toBe("var(--color-undefined)");
  });

  it("preserves curly-brace references in component properties", () => {
    const doc = extractYamlFromContent(
      '---\ncomponents:\n  card:\n    bg: "{colors.primary}"\n---\n',
    );
    const recipe = doc.spec.componentRecipes!.find((r) => r.name === "card");
    expect(recipe!.properties.bg).toBe("{colors.primary}");
  });
});
