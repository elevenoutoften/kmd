import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  mergeSpecs,
  stageMerge,
  EXTRACTOR_PRECEDENCE,
} from "./merge";
import { runDesignPipeline } from "./pipeline";
import type {
  ColorToken,
  DesignSpec,
  DesignDocument,
  Provenance,
} from "./ir";
import { emptyDesignSpec, emptyDesignDocument } from "./ir";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = join(__dirname, "../../../fixtures");

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

function provenance(extractor: string, sourceLine?: number): Provenance {
  return sourceLine != null ? { extractor, sourceLine } : { extractor };
}

function colorToken(
  name: string,
  value: string,
  extractor: string,
  sourceLine?: number,
): ColorToken {
  return { name, value, provenance: provenance(extractor, sourceLine) };
}

function makeDoc(source: string): DesignDocument {
  return emptyDesignDocument(source);
}

// ---------------------------------------------------------------------------
// EXTRACTOR_PRECEDENCE
// ---------------------------------------------------------------------------

describe("EXTRACTOR_PRECEDENCE", () => {
  it("yaml has highest precedence", () => {
    const idx = EXTRACTOR_PRECEDENCE.indexOf("yaml");
    expect(idx).toBe(EXTRACTOR_PRECEDENCE.length - 1);
  });

  it("layout has lowest precedence", () => {
    expect(EXTRACTOR_PRECEDENCE[0]).toBe("layout");
  });

  it("documents the full order", () => {
    expect([...EXTRACTOR_PRECEDENCE]).toEqual([
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
    ]);
  });
});

// ---------------------------------------------------------------------------
// Precedence-based merge
// ---------------------------------------------------------------------------

describe("mergeSpecs precedence", () => {
  it("yaml value wins over table value for same-named token", () => {
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [
        colorToken("primary", "#ff0000", "table", 10),
        colorToken("primary", "#00ff00", "yaml", 5),
      ],
    };

    const { spec, diagnostics } = mergeSpecs([partial]);

    expect(spec.colorTokens).toHaveLength(1);
    expect(spec.colorTokens![0]!.value).toBe("#00ff00");
    expect(spec.colorTokens![0]!.provenance.extractor).toBe("yaml");
    // Conflict emitted because values differ
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.token).toBe("primary");
  });

  it("table value wins over css value", () => {
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [
        colorToken("--color-canvas", "#ffffff", "css", 30),
        colorToken("--color-canvas", "#fefefe", "table", 20),
      ],
    };

    const { spec } = mergeSpecs([partial]);

    expect(spec.colorTokens).toHaveLength(1);
    expect(spec.colorTokens![0]!.value).toBe("#fefefe");
    expect(spec.colorTokens![0]!.provenance.extractor).toBe("table");
  });

  it("keeps single-extractor token without conflicts", () => {
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [
        colorToken("--color-ink", "#17191c", "table", 15),
      ],
    };

    const { spec, diagnostics } = mergeSpecs([partial]);

    expect(spec.colorTokens).toHaveLength(1);
    expect(spec.colorTokens![0]!.value).toBe("#17191c");
    expect(diagnostics).toHaveLength(0);
  });

  it("resolves full precedence chain", () => {
    // Every extractor provides the same token name
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [
        colorToken("brand", "#111111", "layout", 1),
        colorToken("brand", "#222222", "surface", 2),
        colorToken("brand", "#333333", "gradient", 3),
        colorToken("brand", "#444444", "shadow", 4),
        colorToken("brand", "#555555", "components", 5),
        colorToken("brand", "#666666", "prose", 6),
        colorToken("brand", "#777777", "css", 7),
        colorToken("brand", "#888888", "table", 8),
        colorToken("brand", "#999999", "dtcg", 9),
        colorToken("brand", "#aaaaaa", "yaml", 10),
      ],
    };

    const { spec, diagnostics } = mergeSpecs([partial]);

    expect(spec.colorTokens).toHaveLength(1);
    expect(spec.colorTokens![0]!.value).toBe("#aaaaaa");
    expect(spec.colorTokens![0]!.provenance.extractor).toBe("yaml");
    // All 9 losers differ → 9 conflict warnings
    expect(diagnostics).toHaveLength(9);
    expect(diagnostics.every((d) => d.severity === "warning")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

describe("mergeSpecs conflict detection", () => {
  it("emits conflict when two extractors provide different values", () => {
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [
        colorToken("accent", "#ff0000", "css", 10),
        colorToken("accent", "#00ff00", "table", 20),
      ],
    };

    const { diagnostics } = mergeSpecs([partial]);

    expect(diagnostics).toHaveLength(1);
    const diag = diagnostics[0]!;
    expect(diag.severity).toBe("warning");
    expect(diag.token).toBe("accent");
    expect(diag.message).toContain("css");
    expect(diag.message).toContain("table");
  });

  it("does not emit conflict when values are identical", () => {
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [
        colorToken("primary", "#ff0000", "css", 10),
        colorToken("primary", "#ff0000", "table", 20),
      ],
    };

    const { diagnostics } = mergeSpecs([partial]);
    expect(diagnostics).toHaveLength(0);
  });

  it("normalises values before comparing (case-insensitive)", () => {
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [
        colorToken("primary", "#FF0000", "css", 10),
        colorToken("primary", "#ff0000", "table", 20),
      ],
    };

    const { diagnostics } = mergeSpecs([partial]);
    expect(diagnostics).toHaveLength(0);
  });

  it("includes source line in conflict message when available", () => {
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [
        colorToken("bg", "#fff", "css", 42),
        colorToken("bg", "#000", "table", 100),
      ],
    };

    const { diagnostics } = mergeSpecs([partial]);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain("line 100");
    expect(diagnostics[0]!.message).toContain("line 42");
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe("mergeSpecs idempotency", () => {
  it("mergeSpecs([merged]) deep-equals mergeSpecs([original])", () => {
    const original: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [
        colorToken("a", "#111", "css", 1),
        colorToken("a", "#222", "yaml", 2),
        colorToken("b", "#333", "table", 3),
      ],
      spacingTokens: [
        {
          name: "sm",
          value: "4px",
          provenance: provenance("table", 10),
        },
      ],
    };

    const first = mergeSpecs([original]);
    const second = mergeSpecs([first.spec]);

    // The spec must be idempotent — re-merging an already-merged spec
    // produces an identical spec.
    expect(second.spec).toEqual(first.spec);
    // After the first merge, conflicts are resolved (single token per name),
    // so the second merge produces no diagnostics. This is correct and
    // expected: diagnostics are a transient side-effect, not part of the spec.
    expect(second.diagnostics).toHaveLength(0);
    expect(first.diagnostics.length).toBeGreaterThan(0);
  });

  it("idempotent after multiple rounds", () => {
    const original: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [
        colorToken("x", "#aaa", "table", 1),
        colorToken("x", "#bbb", "yaml", 2),
      ],
    };

    let result = mergeSpecs([original]);
    for (let i = 0; i < 5; i++) {
      const next = mergeSpecs([result.spec]);
      expect(next.spec).toEqual(result.spec);
      expect(next.diagnostics).toHaveLength(0);
      result = next;
    }
  });
});

// ---------------------------------------------------------------------------
// Permutation property
// ---------------------------------------------------------------------------

describe("mergeSpecs permutation property", () => {
  it("any permutation of partials yields same result", () => {
    const p1: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [colorToken("primary", "#ff0000", "css", 1)],
    };
    const p2: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [colorToken("primary", "#00ff00", "table", 2)],
    };
    const p3: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [colorToken("primary", "#0000ff", "yaml", 3)],
    };

    const order1 = mergeSpecs([p1, p2, p3]);
    const order2 = mergeSpecs([p3, p1, p2]);
    const order3 = mergeSpecs([p2, p3, p1]);

    expect(order2.spec.colorTokens).toEqual(order1.spec.colorTokens);
    expect(order3.spec.colorTokens).toEqual(order1.spec.colorTokens);
    expect(order2.diagnostics).toEqual(order1.diagnostics);
    expect(order3.diagnostics).toEqual(order1.diagnostics);
  });

  it("same-precedence items from different partials yield same result", () => {
    // Two css extractors (same precedence) providing same-named tokens
    const p1: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [colorToken("bg", "#fff", "css", 1)],
    };
    const p2: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [colorToken("bg", "#fff", "css", 2)],
    };

    const order1 = mergeSpecs([p1, p2]);
    const order2 = mergeSpecs([p2, p1]);

    // Same values → no conflict, same token
    expect(order1.spec.colorTokens).toEqual(order2.spec.colorTokens);
    expect(order1.diagnostics).toHaveLength(0);
    expect(order2.diagnostics).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Flat map merge
// ---------------------------------------------------------------------------

describe("mergeSpecs flat maps", () => {
  it("merges colors flat map with higher precedence winning", () => {
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      colors: { primary: "#old" },
      colorTokens: [
        colorToken("primary", "#ff0000", "table", 1),
        colorToken("primary", "#00ff00", "yaml", 2),
      ],
    };

    const { spec } = mergeSpecs([partial]);

    expect(spec.colors["primary"]).toBe("#00ff00");
  });

  it("preserves keys from flat map not in token arrays", () => {
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      colors: { "extra-color": "#abc" },
      colorTokens: [],
    };

    const { spec } = mergeSpecs([partial]);

    expect(spec.colors["extra-color"]).toBe("#abc");
  });
});

// ---------------------------------------------------------------------------
// Multi-type merge
// ---------------------------------------------------------------------------

describe("mergeSpecs multiple token types", () => {
  it("merges spacing, radius, and typography tokens", () => {
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      spacingTokens: [
        {
          name: "sm",
          value: "4px",
          provenance: provenance("css", 1),
        },
        {
          name: "sm",
          value: "8px",
          provenance: provenance("yaml", 2),
        },
      ],
      radiusTokens: [
        {
          name: "card",
          value: "12px",
          provenance: provenance("table", 3),
        },
      ],
      typographyTokens: [
        {
          name: "body",
          value: "16px",
          provenance: provenance("prose", 4),
        },
        {
          name: "body",
          value: "15px",
          provenance: provenance("table", 5),
        },
      ],
    };

    const { spec, diagnostics } = mergeSpecs([partial]);

    // spacing: yaml wins
    expect(spec.spacingTokens).toHaveLength(1);
    expect(spec.spacingTokens![0]!.value).toBe("8px");

    // radius: single source
    expect(spec.radiusTokens).toHaveLength(1);
    expect(spec.radiusTokens![0]!.value).toBe("12px");

    // typography: table wins (higher than prose)
    expect(spec.typographyTokens).toHaveLength(1);
    expect(spec.typographyTokens![0]!.value).toBe("15px");

    // Two conflicts (spacing + typography)
    expect(diagnostics).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// ComponentRecipe merge
// ---------------------------------------------------------------------------

describe("mergeSpecs ComponentRecipe", () => {
  it("merges by name with higher precedence winning for properties", () => {
    const partial: DesignSpec = {
      ...emptyDesignSpec(),
      componentRecipes: [
        {
          name: "button",
          properties: { "bg-color": "#old", radius: "8px" },
          provenance: provenance("prose", 1),
        },
        {
          name: "button",
          properties: { "bg-color": "#new", padding: "12px" },
          provenance: provenance("table", 2),
        },
      ],
    };

    const { spec, diagnostics } = mergeSpecs([partial]);

    expect(spec.componentRecipes).toHaveLength(1);
    const recipe = spec.componentRecipes![0]!;
    expect(recipe.properties["bg-color"]).toBe("#new"); // table wins
    expect(recipe.properties["padding"]).toBe("12px");
    expect(recipe.properties["radius"]).toBe("8px"); // kept from prose
    // Conflict on bg-color
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics.some((d) => d.token === "button.bg-color")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// stageMerge pipeline integration
// ---------------------------------------------------------------------------

describe("stageMerge pipeline stage", () => {
  it("deduplicates tokens and appends conflict diagnostics to doc", () => {
    const doc: DesignDocument = {
      ...emptyDesignDocument(100),
      spec: {
        ...emptyDesignSpec(),
        colorTokens: [
          colorToken("accent", "#ff0000", "css", 10),
          colorToken("accent", "#00ff00", "yaml", 5),
        ],
      },
    };

    stageMerge(doc);

    expect(doc.spec.colorTokens).toHaveLength(1);
    expect(doc.spec.colorTokens![0]!.value).toBe("#00ff00");
    expect(doc.diagnostics).toHaveLength(1);
    expect(doc.diagnostics[0]!.severity).toBe("warning");
  });

  it("handles empty doc without errors", () => {
    const doc = emptyDesignDocument(0);
    stageMerge(doc);

    expect(doc.spec.colorTokens).toHaveLength(0);
    expect(doc.diagnostics).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// dylanbrouwer fixture integration
// ---------------------------------------------------------------------------

describe("dylanbrouwer fixture merge", () => {
  it("table-extracted colors win over CSS-extracted colors for same tokens", () => {
    // Run the full pipeline on the dylanbrouwer fixture
    const content = readFixture("dylanbrouwer-DESIGN.md");
    const doc = runDesignPipeline(content);

    // The fixture has colors from both tables and CSS blocks.
    // Table extractor should win for overlapping token names.
    // Both table and CSS extract --color-canvas but table has higher precedence.
    const canvasToken = doc.spec.colorTokens?.find(
      (t: ColorToken) => t.name === "--color-canvas",
    );

    // If the token exists from both sources, table should win
    if (canvasToken) {
      expect(canvasToken.provenance.extractor).toBe("table");
    }

    // Check that we have colors from both sources merged without duplication
    const colorNames = new Set(
      doc.spec.colorTokens?.map((t: ColorToken) => t.name),
    );

    // Every color name should be unique after merge
    expect(colorNames.size).toBe(doc.spec.colorTokens?.length ?? 0);

    // Check that flat map colors are present
    expect(Object.keys(doc.spec.colors).length).toBeGreaterThan(0);
  });
});
