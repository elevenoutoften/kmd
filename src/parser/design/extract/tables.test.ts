import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { extractTables, extractTablesFromContent } from "./tables";
import type { DesignDocument } from "../ir";
import { splitYamlFrontMatter } from "./yaml";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(name: string): string {
  // Vitest runs from project root.
  const fs = require("fs");
  return fs.readFileSync(resolve(__dirname, "../../../../fixtures", name), "utf-8");
}

function makeDoc(source: string): DesignDocument {
  return {
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
    meta: { name: "", description: "", sourceLength: source.length },
  } as DesignDocument;
}

// ---------------------------------------------------------------------------
// dylanbrouwer-DESIGN.md fixture
// ---------------------------------------------------------------------------

describe("extractTables — dylanbrouwer-DESIGN.md", () => {
  let doc: DesignDocument;

  beforeAll(() => {
    const source = loadFixture("dylanbrouwer-DESIGN.md");
    doc = makeDoc(source);
    doc._sourceContent = source;
    extractTables(doc);
  });

  it("extracts 10 color tokens", () => {
    expect(doc.spec.colorTokens).toHaveLength(10);
  });

  it("extracts 7 typography tokens", () => {
    expect(doc.spec.typographyTokens).toHaveLength(7);
  });

  it("extracts 9 spacing tokens", () => {
    expect(doc.spec.spacingTokens).toHaveLength(9);
  });

  it("extracts 4 surface tokens", () => {
    expect(doc.spec.surfaceTokens).toHaveLength(4);
  });

  it("color tokens have correct values (backtick-stripped)", () => {
    const canvas = doc.spec.colorTokens!.find((t) => t.name === "Canvas");
    expect(canvas).toBeDefined();
    expect(canvas!.value).toBe("#ffffff");
  });

  it("typography tokens have composite values", () => {
    const display = doc.spec.typographyTokens!.find((t) => t.name === "display");
    expect(display).toBeDefined();
    expect(display!.value).toContain("size:44px");
    expect(display!.value).toContain("line-height:1.1");
    expect(display!.value).toContain("letter-spacing:-0.66px");
  });

  it("spacing tokens have correct values", () => {
    const s4 = doc.spec.spacingTokens!.find((t) => t.name === "--spacing-4");
    expect(s4).toBeDefined();
    expect(s4!.value).toBe("4px");
  });

  it("surface tokens have correct names and values", () => {
    const fog = doc.spec.surfaceTokens!.find((t) => t.name === "Fog");
    expect(fog).toBeDefined();
    expect(fog!.value).toBe("#f7f7f8");
  });

  it("all tokens carry table provenance", () => {
    for (const t of doc.spec.colorTokens ?? []) {
      expect(t.provenance.extractor).toBe("table");
      expect(t.provenance.sourceLine).toBeGreaterThan(0);
    }
    for (const t of doc.spec.surfaceTokens ?? []) {
      expect(t.provenance.extractor).toBe("table");
      expect(t.provenance.sourceLine).toBeGreaterThan(0);
    }
  });

  it("populates legacy flat maps for colors and spacing", () => {
    expect(doc.spec.colors["Canvas"]).toBe("#ffffff");
    expect(doc.spec.colors["Ink"]).toBe("#17191c");
    expect(doc.spec.spacing["--spacing-8"]).toBe("8px");
  });
});

// ---------------------------------------------------------------------------
// Malformed / edge cases
// ---------------------------------------------------------------------------

describe("extractTables — edge cases", () => {
  it("skips a 1-column table without throwing", () => {
    const source = `## Colors

| Name |
|------|
| Foo  |
`;
    const doc = extractTablesFromContent(source);
    expect(doc.diagnostics).toHaveLength(0);
    expect(doc.spec.colorTokens).toHaveLength(0);
  });

  it("skips a table under an unrecognized heading", () => {
    const source = `## Random Section

| Name | Value |
|------|-------|
| foo  | bar   |
`;
    const doc = extractTablesFromContent(source);
    expect(doc.spec.colorTokens).toHaveLength(0);
    expect(doc.spec.spacingTokens).toHaveLength(0);
  });

  it("handles empty body gracefully", () => {
    const doc = extractTablesFromContent("");
    expect(doc.diagnostics).toHaveLength(0);
    expect(doc.spec.colorTokens).toHaveLength(0);
  });

  it("handles YAML frontmatter correctly (body only)", () => {
    const source = `---
colors:
  bg: "#fff"
---

## Spacing

| Token | Value |
|-------|-------|
| \`--sp-1\` | 4px |
`;
    const doc = extractTablesFromContent(source);
    expect(doc.spec.spacingTokens).toHaveLength(1);
    expect(doc.spec.spacingTokens![0].name).toBe("--sp-1");
    expect(doc.spec.spacingTokens![0].value).toBe("4px");
    // YAML colors should NOT be extracted by the table extractor.
    expect(doc.spec.colorTokens).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Column order independence
// ---------------------------------------------------------------------------

describe("extractTables — column order independence", () => {
  it("detects value-before-name column order", () => {
    const source = `## Colors

| Value | Name  |
|-------|-------|
| #fff | White |
| #000 | Black |
`;
    const doc = extractTablesFromContent(source);
    expect(doc.spec.colorTokens).toHaveLength(2);
    const white = doc.spec.colorTokens!.find((t) => t.name === "White");
    expect(white).toBeDefined();
    expect(white!.value).toBe("#fff");
  });
});

// ---------------------------------------------------------------------------
// Backtick stripping
// ---------------------------------------------------------------------------

describe("extractTables — backtick stripping", () => {
  it("strips backticks from value cells", () => {
    const source = `## Colors

| Name  | Value      |
|-------|------------|
| White | \`#ffffff\` |
`;
    const doc = extractTablesFromContent(source);
    expect(doc.spec.colorTokens).toHaveLength(1);
    expect(doc.spec.colorTokens![0].value).toBe("#ffffff");
    expect(doc.spec.colorTokens![0].name).toBe("White");
  });
});

// ---------------------------------------------------------------------------
// Palette subheadings under Colors
// ---------------------------------------------------------------------------

describe("extractTables — palette subheadings under Colors", () => {
  it("extracts color tokens from subheadings like Brand Palette, Surface Palette", () => {
    const source = `## Colors

### Brand Palette

| Token     | Hex       | Role                                      |
|-----------|-----------|--------------------------------------------|
| Primary   | \`#78716C\` | Stone — anchors UI elements, links, icons  |
| Secondary | \`#A8A29E\` | Sage — supporting accents, dividers         |

### Surface Palette

| Token          | Hex       | Role                                |
|----------------|-----------|--------------------------------------|
| Background     | \`#FAFAF9\` | Warm white page background           |
| Surface Raised | \`#EFEDEB\` | Hover states, subtle callout blocks  |

### Content Palette

| Token          | Hex       |
|----------------|-----------|
| Text Primary   | \`#1C1917\` |
| Text Muted     | \`#A8A29E\` |

### Border Palette

| Token         | Hex       |
|---------------|-----------|
| Border Subtle | \`#E7E5E4\` |

### Semantic Colors

| Token   | Hex       |
|---------|-----------|
| Success | \`#65A30D\` |
`;
    const doc = extractTablesFromContent(source);
    const tokens = doc.spec.colorTokens!;

    expect(tokens.length).toBeGreaterThanOrEqual(7);

    const primary = tokens.find((t) => t.name === "Primary");
    expect(primary).toBeDefined();
    expect(primary!.value).toBe("#78716C");
    expect(primary!.description).toContain("Brand");

    const bg = tokens.find((t) => t.name === "Background");
    expect(bg).toBeDefined();
    expect(bg!.value).toBe("#FAFAF9");
    expect(bg!.description).toContain("Surface");

    const textPrimary = tokens.find((t) => t.name === "Text Primary");
    expect(textPrimary).toBeDefined();
    expect(textPrimary!.value).toBe("#1C1917");

    const borderSubtle = tokens.find((t) => t.name === "Border Subtle");
    expect(borderSubtle).toBeDefined();
    expect(borderSubtle!.value).toBe("#E7E5E4");

    const success = tokens.find((t) => t.name === "Success");
    expect(success).toBeDefined();
    expect(success!.value).toBe("#65A30D");
  });

  it("sets ColorGroup from palette subheading", () => {
    const source = `## Colors

### Brand Palette

| Token   | Hex       |
|---------|-----------|
| Primary | \`#78716C\` |

### Surface Palette

| Token      | Hex       |
|------------|-----------|
| Background | \`#FAFAF9\` |

### Semantic Colors

| Token   | Hex       |
|---------|-----------|
| Success | \`#65A30D\` |
`;
    const doc = extractTablesFromContent(source);
    const tokens = doc.spec.colorTokens!;

    const brand = tokens.find((t) => t.name === "Primary");
    expect(brand!.group).toBe("Brand");

    const surface = tokens.find((t) => t.name === "Background");
    expect(surface!.group).toBe("Surface");

    const semantic = tokens.find((t) => t.name === "Success");
    expect(semantic!.group).toBe("Semantic");
  });

  it("resets color context when a same-level heading appears", () => {
    const source = `## Colors

### Brand Palette

| Token   | Hex       |
|---------|-----------|
| Primary | \`#78716C\` |

## Typography

| Role   | Size |
|--------|------|
| body   | 15px |
`;
    const doc = extractTablesFromContent(source);
    expect(doc.spec.colorTokens).toHaveLength(1);
    expect(doc.spec.typographyTokens).toHaveLength(1);
  });

  it("captures description from Role column when name is already taken", () => {
    const source = `## Colors

| Token   | Hex       | Role                |
|---------|-----------|---------------------|
| Primary | \`#78716C\` | Main action color   |
`;
    const doc = extractTablesFromContent(source);
    const token = doc.spec.colorTokens![0];
    expect(token.name).toBe("Primary");
    expect(token.value).toBe("#78716C");
    expect(token.description).toBe("Main action color");
  });

  it("preserves description when both Role column and palette group present", () => {
    const source = `## Colors

### Brand Palette

| Token   | Hex       | Role                            |
|---------|-----------|----------------------------------|
| Primary | \`#78716C\` | Stone — anchors UI elements      |
`;
    const doc = extractTablesFromContent(source);
    const token = doc.spec.colorTokens![0];
    expect(token.name).toBe("Primary");
    expect(token.description).toContain("Brand");
    expect(token.description).toContain("Stone");
  });
});

// ---------------------------------------------------------------------------
// ThoughtStream-shaped fixture (palette subheadings with mixed columns)
// ---------------------------------------------------------------------------

describe("extractTables — ThoughtStream-shaped fixture", () => {
  function loadSample(name: string): string {
    const fs = require("fs");
    return fs.readFileSync(resolve(__dirname, "../../../../samples", name), "utf-8");
  }

  it("extracts key palette color tokens from ThoughtStream source", () => {
    const source = loadSample("thoughtstream-DESIGN.md");
    const doc = extractTablesFromContent(source);
    const tokens = doc.spec.colorTokens!;

    const expectedTokens: Array<{ name: string; value: string }> = [
      { name: "Primary", value: "#78716C" },
      { name: "Background", value: "#FAFAF9" },
      { name: "Surface", value: "#F5F5F4" },
      { name: "Surface Raised", value: "#EFEDEB" },
      { name: "Text Primary", value: "#1C1917" },
      { name: "Text Secondary", value: "#57534E" },
      { name: "Text Tertiary", value: "#A8A29E" },
      { name: "Border Subtle", value: "#E7E5E4" },
      { name: "Border Medium", value: "#D6D3D1" },
      { name: "Border Strong", value: "#A8A29E" },
      { name: "Success", value: "#65A30D" },
      { name: "Warning", value: "#CA8A04" },
      { name: "Error", value: "#DC2626" },
      { name: "Info", value: "#78716C" },
    ];

    for (const expected of expectedTokens) {
      const found = tokens.find((t) => t.name === expected.name);
      expect(found, `Missing color token: ${expected.name}`).toBeDefined();
      expect(found!.value, `Wrong value for ${expected.name}`).toBe(expected.value);
    }
  });

  it("annotates palette group on ThoughtStream tokens", () => {
    const source = loadSample("thoughtstream-DESIGN.md");
    const doc = extractTablesFromContent(source);
    const tokens = doc.spec.colorTokens!;

    const brandToken = tokens.find((t) => t.name === "Primary");
    expect(brandToken!.group).toBe("Brand");

    const surfaceToken = tokens.find((t) => t.name === "Background");
    expect(surfaceToken!.group).toBe("Surface");

    const semanticToken = tokens.find((t) => t.name === "Success");
    expect(semanticToken!.group).toBe("Semantic");
  });

  it("populates legacy flat color map with ThoughtStream tokens", () => {
    const source = loadSample("thoughtstream-DESIGN.md");
    const doc = extractTablesFromContent(source);

    expect(doc.spec.colors["Background"]).toBe("#FAFAF9");
    expect(doc.spec.colors["Text Primary"]).toBe("#1C1917");
    expect(doc.spec.colors["Border Subtle"]).toBe("#E7E5E4");
    expect(doc.spec.colors["Primary"]).toBe("#78716C");
  });
});
