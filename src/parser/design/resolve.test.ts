import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { resolveSpec } from "./resolve";
import { runDesignPipeline } from "./pipeline";
import type {
  ColorToken,
  TypographyToken,
  SpacingToken,
  RadiusToken,
  ComponentRecipe,
  DesignDocument,
  Provenance,
} from "./ir";
import { emptyDesignDocument } from "./ir";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = join(__dirname, "../../../fixtures");

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

function prov(extractor: string, sourceLine?: number): Provenance {
  return sourceLine != null ? { extractor, sourceLine } : { extractor };
}

function colorToken(
  name: string,
  value: string,
  extractor = "test",
): ColorToken {
  return { name, value, provenance: prov(extractor) };
}

function spacingToken(
  name: string,
  value: string,
  extractor = "test",
): SpacingToken {
  return { name, value, provenance: prov(extractor) };
}

function radiusToken(
  name: string,
  value: string,
  extractor = "test",
): RadiusToken {
  return { name, value, provenance: prov(extractor) };
}

function typoToken(
  name: string,
  value: Record<string, string>,
  extractor = "test",
): TypographyToken {
  return { name, value: JSON.stringify(value), provenance: prov(extractor) };
}

function component(
  name: string,
  properties: Record<string, string>,
  extractor = "test",
): ComponentRecipe {
  return { name, properties, provenance: prov(extractor) };
}

function makeDoc(overrides?: Partial<DesignDocument["spec"]>): DesignDocument {
  const doc = emptyDesignDocument("");
  if (overrides) {
    Object.assign(doc.spec, overrides);
  }
  return doc;
}

// ---------------------------------------------------------------------------
// Reference resolution: {group.name}
// ---------------------------------------------------------------------------

describe("resolveSpec: {group.name} resolution", () => {
  it("resolves {colors.primary} in a component to the actual color value", () => {
    const doc = makeDoc({
      colorTokens: [colorToken("primary", "#007AFF")],
      componentRecipes: [
        component("button", { background: "{colors.primary}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.background).toBe(
      "#007AFF",
    );
    expect(doc.diagnostics).toHaveLength(0);
  });

  it("resolves multiple references in a single value", () => {
    const doc = makeDoc({
      spacingTokens: [
        spacingToken("sm", "12px"),
        spacingToken("lg", "24px"),
      ],
      componentRecipes: [
        component("button", { padding: "{spacing.sm} {spacing.lg}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.padding).toBe(
      "12px 24px",
    );
  });

  it("resolves {radii.md} via suffix match against radius-md token", () => {
    const doc = makeDoc({
      radiusTokens: [radiusToken("radius-md", "12px")],
      componentRecipes: [
        component("card", { radius: "{radii.md}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.radius).toBe("12px");
  });

  it("leaves literal values unchanged", () => {
    const doc = makeDoc({
      componentRecipes: [
        component("badge", { foreground: "#FFFFFF", shadow: "0 2px 8px rgba(0,0,0,0.08)" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.foreground).toBe(
      "#FFFFFF",
    );
    expect(doc.spec.componentRecipes![0]!.properties.shadow).toBe(
      "0 2px 8px rgba(0,0,0,0.08)",
    );
    expect(doc.diagnostics).toHaveLength(0);
  });

  it("resolves flat-map values when no typed token exists", () => {
    const doc = makeDoc({
      colors: { primary: "#FF0000" },
      componentRecipes: [
        component("el", { bg: "{colors.primary}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.bg).toBe("#FF0000");
  });
});

// ---------------------------------------------------------------------------
// Reference resolution: other patterns
// ---------------------------------------------------------------------------

describe("resolveSpec: var() / ${} / tokens. patterns", () => {
  it("resolves var(--primary) references", () => {
    const doc = makeDoc({
      colorTokens: [colorToken("primary", "#007AFF")],
      componentRecipes: [
        component("el", { color: "var(--primary)" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.color).toBe("#007AFF");
  });

  it("resolves ${primary} template references", () => {
    const doc = makeDoc({
      spacingTokens: [spacingToken("md", "16px")],
      componentRecipes: [
        component("el", { padding: "${md}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.padding).toBe("16px");
  });

  it("resolves tokens.colors.primary dot-notation references", () => {
    const doc = makeDoc({
      colorTokens: [colorToken("primary", "#007AFF")],
      componentRecipes: [
        component("el", { bg: "tokens.colors.primary" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.bg).toBe("#007AFF");
  });
});

// ---------------------------------------------------------------------------
// Composite typography expansion
// ---------------------------------------------------------------------------

describe("resolveSpec: composite typography expansion", () => {
  it("expands a sole {typography.body} reference into font properties", () => {
    const doc = makeDoc({
      typographyTokens: [
        typoToken("body", {
          "font-family": '"SF Pro Text", system-ui, sans-serif',
          "font-size": "17px",
          "font-weight": "400",
          "line-height": "1.6",
          "letter-spacing": "0em",
        }),
      ],
      componentRecipes: [
        component("text-block", { typography: "{typography.body}" }),
      ],
    });

    resolveSpec(doc);

    const props = doc.spec.componentRecipes![0]!.properties;

    // Original typography key should be removed
    expect(props).not.toHaveProperty("typography");

    // Expanded camelCase properties
    expect(props.fontFamily).toBe('"SF Pro Text", system-ui, sans-serif');
    expect(props.fontSize).toBe("17px");
    expect(props.fontWeight).toBe("400");
    expect(props.lineHeight).toBe("1.6");
    expect(props.letterSpacing).toBe("0em");

    expect(doc.diagnostics).toHaveLength(0);
  });

  it("does not expand when typography ref is not sole value", () => {
    const doc = makeDoc({
      typographyTokens: [
        typoToken("body", { "font-size": "17px" }),
      ],
      componentRecipes: [
        component("el", { label: "uses {typography.body} style" }),
      ],
    });

    resolveSpec(doc);

    // Mixed text → resolved the reference inline, no expansion
    const props = doc.spec.componentRecipes![0]!.properties;
    expect(props.label).toBe('uses {"font-size":"17px"} style');
  });

  it("resolves references inside expanded typography values", () => {
    const doc = makeDoc({
      colorTokens: [colorToken("text-color", "#1C1C1E")],
      typographyTokens: [
        typoToken("body", {
          "font-size": "17px",
          "color": "{colors.text-color}",
        }),
      ],
      componentRecipes: [
        component("el", { typography: "{typography.body}" }),
      ],
    });

    resolveSpec(doc);

    const props = doc.spec.componentRecipes![0]!.properties;
    expect(props.color).toBe("#1C1C1E");
  });
});

// ---------------------------------------------------------------------------
// Broken references
// ---------------------------------------------------------------------------

describe("resolveSpec: broken-ref diagnostics", () => {
  it("emits warning for unresolved {colors.unknown}", () => {
    const doc = makeDoc({
      componentRecipes: [
        component("el", { bg: "{colors.unknown}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.diagnostics).toHaveLength(1);
    expect(doc.diagnostics[0]!.severity).toBe("warning");
    expect(doc.diagnostics[0]!.message).toContain("Unresolved reference");
    expect(doc.diagnostics[0]!.message).toContain("colors.unknown");

    // Original ref kept as fallback
    expect(doc.spec.componentRecipes![0]!.properties.bg).toBe(
      "{colors.unknown}",
    );
  });

  it("emits warning for unresolved var(--missing)", () => {
    const doc = makeDoc({
      componentRecipes: [
        component("el", { color: "var(--missing)" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.diagnostics).toHaveLength(1);
    expect(doc.diagnostics[0]!.severity).toBe("warning");
    expect(doc.spec.componentRecipes![0]!.properties.color).toBe(
      "{missing}",
    );
  });
});

// ---------------------------------------------------------------------------
// Circular references
// ---------------------------------------------------------------------------

describe("resolveSpec: circular-ref diagnostics", () => {
  it("detects A→B→A cycle and emits error diagnostic", () => {
    const doc = makeDoc({
      colorTokens: [
        colorToken("tokenA", "{colors.tokenB}"),
        colorToken("tokenB", "{colors.tokenA}"),
      ],
      componentRecipes: [
        component("el", { color: "{colors.tokenA}" }),
      ],
    });

    resolveSpec(doc);

    // Should have at least one circular-ref error
    const circularDiags = doc.diagnostics.filter(
      (d) => d.severity === "error" && d.message.includes("Circular reference"),
    );
    expect(circularDiags.length).toBeGreaterThanOrEqual(1);
    expect(circularDiags[0]!.message).toContain("tokenA");

    // Fallback: the original reference string is preserved
    expect(doc.spec.componentRecipes![0]!.properties.color).toBe(
      "{colors.tokenA}",
    );
  });

  it("detects self-referencing token", () => {
    const doc = makeDoc({
      colorTokens: [colorToken("self", "{colors.self}")],
      componentRecipes: [
        component("el", { color: "{colors.self}" }),
      ],
    });

    resolveSpec(doc);

    const circularDiags = doc.diagnostics.filter(
      (d) => d.severity === "error" && d.message.includes("Circular reference"),
    );
    expect(circularDiags.length).toBeGreaterThanOrEqual(1);
    expect(doc.spec.componentRecipes![0]!.properties.color).toBe(
      "{colors.self}",
    );
  });
});

// ---------------------------------------------------------------------------
// Token value resolution
// ---------------------------------------------------------------------------

describe("resolveSpec: token value resolution", () => {
  it("resolves references in color token values", () => {
    const doc = makeDoc({
      colorTokens: [
        colorToken("base", "#007AFF"),
        colorToken("derived", "{colors.base}"),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.colorTokens![1]!.value).toBe("#007AFF");
  });
});

// ---------------------------------------------------------------------------
// Group alias resolution
// ---------------------------------------------------------------------------

describe("resolveSpec: group aliases", () => {
  it("resolves {rounded.full} through radii group alias", () => {
    const doc = makeDoc({
      radii: { full: "9999px" },
      componentRecipes: [
        component("pill", { radius: "{rounded.full}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.radius).toBe("9999px");
    expect(doc.diagnostics).toHaveLength(0);
  });

  it("resolves {radius.full} through radii group alias", () => {
    const doc = makeDoc({
      radii: { full: "9999px" },
      componentRecipes: [
        component("pill", { radius: "{radius.full}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.radius).toBe("9999px");
    expect(doc.diagnostics).toHaveLength(0);
  });

  it("resolves {radii.full} directly (existing behavior)", () => {
    const doc = makeDoc({
      radii: { full: "9999px" },
      componentRecipes: [
        component("pill", { radius: "{radii.full}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.radius).toBe("9999px");
    expect(doc.diagnostics).toHaveLength(0);
  });

  it("resolves {color.primary} through colors group alias", () => {
    const doc = makeDoc({
      colors: { primary: "#007AFF" },
      componentRecipes: [
        component("el", { background: "{color.primary}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.background).toBe(
      "#007AFF",
    );
    expect(doc.diagnostics).toHaveLength(0);
  });

  it("resolves {colors.primary} directly (existing behavior)", () => {
    const doc = makeDoc({
      colors: { primary: "#007AFF" },
      componentRecipes: [
        component("el", { background: "{colors.primary}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.background).toBe(
      "#007AFF",
    );
    expect(doc.diagnostics).toHaveLength(0);
  });

  it("resolves {rounded.pill} via suffix match in aliased radii group", () => {
    const doc = makeDoc({
      radiusTokens: [radiusToken("radius-pill", "9999px")],
      componentRecipes: [
        component("chip", { radius: "{rounded.pill}" }),
      ],
    });

    resolveSpec(doc);

    expect(doc.spec.componentRecipes![0]!.properties.radius).toBe("9999px");
    expect(doc.diagnostics).toHaveLength(0);
  });

  it("component recipe with {rounded.pill} does not leak unresolved ref", () => {
    const doc = makeDoc({
      radiusTokens: [
        radiusToken("radius-pill", "9999px"),
        radiusToken("radius-md", "8px"),
      ],
      colorTokens: [colorToken("primary", "#007AFF")],
      componentRecipes: [
        component("button-primary", {
          background: "{colors.primary}",
          foreground: "#FFFFFF",
          radius: "{rounded.pill}",
          padding: "{spacing.md}",
        }),
      ],
      spacingTokens: [spacingToken("md", "16px")],
    });

    resolveSpec(doc);

    const props = doc.spec.componentRecipes![0]!.properties;
    expect(props.background).toBe("#007AFF");
    expect(props.foreground).toBe("#FFFFFF");
    expect(props.radius).toBe("9999px");
    expect(props.padding).toBe("16px");

    for (const key of Object.keys(props)) {
      expect(props[key]).not.toMatch(/\{rounded\./);
      expect(props[key]).not.toMatch(/\{color\./);
    }

    expect(doc.diagnostics).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: apple-DESIGN.md fixture
// ---------------------------------------------------------------------------

describe("resolveSpec: apple-DESIGN.md integration", () => {
  it("resolves component references from the fixture", () => {
    const source = readFixture("apple-DESIGN.md");
    const doc = runDesignPipeline(source);

    // Pipeline should produce component recipes
    expect(doc.spec.componentRecipes).toBeDefined();
    expect(doc.spec.componentRecipes!.length).toBeGreaterThan(0);

    // Find button-primary component
    const btn = doc.spec.componentRecipes!.find(
      (r) => r.name === "button-primary",
    );
    expect(btn).toBeDefined();

    // background: "{colors.primary}" → should resolve to #007AFF
    expect(btn!.properties.background).toBe("#007AFF");

    // foreground: "#FFFFFF" → literal, unchanged
    expect(btn!.properties.foreground).toBe("#FFFFFF");

    // radius: "{radii.md}" → should resolve (radius-md = 12px)
    expect(btn!.properties.radius).toBe("12px");

    // padding: "{spacing.sm} {spacing.lg}" → resolved
    expect(btn!.properties.padding).toBe("12px 24px");
  });

  it("resolves multiple component references correctly", () => {
    const source = readFixture("apple-DESIGN.md");
    const doc = runDesignPipeline(source);

    // card component
    const card = doc.spec.componentRecipes!.find((r) => r.name === "card");
    expect(card).toBeDefined();
    expect(card!.properties.background).toBe("#FFFFFF"); // {colors.surface} → color-surface
    expect(card!.properties.foreground).toBe("#1C1C1E"); // {colors.on-surface} → color-on-surface
    expect(card!.properties.radius).toBe("16px"); // {radii.lg} → radius-lg
    expect(card!.properties.padding).toBe("24px"); // {spacing.lg} → space-lg
  });

  it("emits no unresolved-reference diagnostics for the fixture", () => {
    const source = readFixture("apple-DESIGN.md");
    const doc = runDesignPipeline(source);

    const brokenRefs = doc.diagnostics.filter(
      (d) =>
        d.severity === "warning" && d.message.includes("Unresolved reference"),
    );
    // The apple fixture's references should all be resolvable via suffix match
    expect(brokenRefs).toHaveLength(0);
  });
});
