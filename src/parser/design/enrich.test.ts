import { describe, it, expect } from "vitest";
import { enrichSpec } from "./enrich";
import { runDesignPipeline } from "./pipeline";
import type { ColorToken, DesignDocument } from "./ir";
import DYLANBROUWER from "../../../fixtures/dylanbrouwer-DESIGN.md?raw";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(colorTokens?: ColorToken[]): DesignDocument {
  return {
    spec: {
      colors: {},
      typography: {},
      spacing: {},
      radii: {},
      layout: {},
      raw: {},
      colorTokens: colorTokens ?? [],
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
    meta: { name: "", description: "", sourceLength: 0 },
  };
}

function token(name: string, value: string): ColorToken {
  return { name, value, provenance: { extractor: "test" } };
}

function findToken(doc: DesignDocument, substr: string): ColorToken | undefined {
  const lower = substr.toLowerCase();
  return doc.spec.colorTokens?.find((t) => t.name.toLowerCase().includes(lower));
}

// ---------------------------------------------------------------------------
// Role inference — name patterns
// ---------------------------------------------------------------------------

describe("enrichSpec — role inference from name", () => {
  it("infers 'brand' from 'primary'", () => {
    const doc = makeDoc([token("primary", "#007AFF")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("brand");
  });

  it("infers 'accent' from 'secondary'", () => {
    const doc = makeDoc([token("secondary", "#5856D6")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("accent");
  });

  it("infers 'background' from 'background'", () => {
    const doc = makeDoc([token("background", "#FAFAFA")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("background");
  });

  it("infers 'background' from 'bg'", () => {
    const doc = makeDoc([token("bg", "#FFFFFF")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("background");
  });

  it("infers 'surface' from 'surface'", () => {
    const doc = makeDoc([token("surface", "#FFFFFF")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("surface");
  });

  it("infers 'text' from 'text'", () => {
    const doc = makeDoc([token("text", "#17191C")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("text");
  });

  it("infers 'text' from 'foreground'", () => {
    const doc = makeDoc([token("foreground", "#17191C")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("text");
  });

  it("infers 'text' from 'ink'", () => {
    const doc = makeDoc([token("ink", "#17191C")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("text");
  });

  it("infers 'text-muted' from 'muted'", () => {
    const doc = makeDoc([token("muted-stone", "#4C4C4C")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("text-muted");
  });

  it("infers 'divider' from 'divider'", () => {
    const doc = makeDoc([token("divider", "#C6C6C8")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("divider");
  });

  it("infers 'success' from 'success'", () => {
    const doc = makeDoc([token("success", "#34C759")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("success");
  });

  it("infers 'warning' from 'warning'", () => {
    const doc = makeDoc([token("warning", "#FF9500")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("warning");
  });

  it("infers 'error' from 'error'", () => {
    const doc = makeDoc([token("error", "#FF3B30")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("error");
  });

  it("infers 'error' from 'danger'", () => {
    const doc = makeDoc([token("danger", "#FF3B30")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("error");
  });

  it("infers 'info' from 'info'", () => {
    const doc = makeDoc([token("info", "#007AFF")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("info");
  });

  it("strips 'color-' prefix before matching", () => {
    const doc = makeDoc([token("color-primary", "#007AFF")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("brand");
  });

  it("strips '--color-' prefix before matching", () => {
    const doc = makeDoc([token("--color-primary", "#007AFF")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("brand");
  });
});

// ---------------------------------------------------------------------------
// Role inference — value heuristics
// ---------------------------------------------------------------------------

describe("enrichSpec — role inference from value", () => {
  it("infers 'background' from very light low-sat hex", () => {
    const doc = makeDoc([token("custom-light", "#F0F0F0")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("background");
  });

  it("infers 'background' from light hex with some warmth", () => {
    // #fbe1d1 (warm mist) — high luminance
    const doc = makeDoc([token("xyz", "#fbe1d1")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("background");
  });

  it("infers 'text' from very dark low-sat hex", () => {
    // #17191c (ink)
    const doc = makeDoc([token("custom-dark", "#17191c")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("text");
  });

  it("infers 'brand' from high-saturation dark hex", () => {
    // #5d2a1a (terracotta) — high sat, low lum
    const doc = makeDoc([token("xyz", "#5d2a1a")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("brand");
  });

  it("infers 'brand' from high-saturation mid-lum hex", () => {
    // #D946EF (vivid purple)
    const doc = makeDoc([token("xyz", "#D946EF")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("brand");
  });

  it("defaults to 'other' when nothing matches", () => {
    // Mid-grey, no name pattern
    const doc = makeDoc([token("custom", "#808080")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("other");
  });

  it("name pattern takes priority over value heuristic", () => {
    // Named "text" but has a light value — name should win
    const doc = makeDoc([token("text-highlight", "#EEEEEE")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.role).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// Group inference
// ---------------------------------------------------------------------------

describe("enrichSpec — group inference", () => {
  it("groups 'brand' role into Brand", () => {
    const doc = makeDoc([token("primary", "#007AFF")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.group).toBe("Brand");
  });

  it("groups 'accent' role into Brand", () => {
    const doc = makeDoc([token("secondary", "#5856D6")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.group).toBe("Brand");
  });

  it("groups 'text' role into Neutrals", () => {
    const doc = makeDoc([token("text-body", "#1C1C1E")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.group).toBe("Neutrals");
  });

  it("groups 'text-muted' role into Neutrals", () => {
    const doc = makeDoc([token("text-muted", "#8E8E93")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.group).toBe("Neutrals");
  });

  it("groups 'surface' role into Surface", () => {
    const doc = makeDoc([token("surface", "#FFFFFF")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.group).toBe("Surface");
  });

  it("groups 'background' role into Surface", () => {
    const doc = makeDoc([token("background", "#FAFAFA")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.group).toBe("Surface");
  });

  it("groups 'success' role into Semantic", () => {
    const doc = makeDoc([token("success", "#34C759")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.group).toBe("Semantic");
  });

  it("groups 'error' role into Semantic", () => {
    const doc = makeDoc([token("error", "#FF3B30")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.group).toBe("Semantic");
  });

  it("groups desaturated 'other' into Neutrals", () => {
    // #808080 — mid-grey, desaturated, no name pattern
    const doc = makeDoc([token("custom", "#808080")]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.group).toBe("Neutrals");
  });

  it("groups saturated 'other' into Other", () => {
    // A colour with moderate saturation that doesn't match any name or value rule.
    // Use a colour that's not very dark, not very light, not very saturated —
    // but with enough colour to avoid the desaturation check.
    // Actually "other" with low sat → Neutrals. Let's use one with mid sat
    // that falls through.
    // Use a low-saturation mid-lum colour that gets "other" role but sat < 0.1 → Neutrals.
    // To get "Other" group, we need a colour that:
    //   - has no name match
    //   - has no strong value heuristic
    //   - has saturation >= 0.1
    // A muted teal like #6A8A8A: R=106, G=138, B=138
    // sat ≈ 0.13 — just above 0.1
    const doc = makeDoc([token("custom", "#6A8A8A")]);
    enrichSpec(doc);
    // lum ≈ 0.18, sat ≈ 0.13 — not dark enough for text, not light enough for bg,
    // not saturated enough for brand → role "other", sat ≥ 0.1 → group "Other"
    expect(doc.spec.colorTokens![0]!.group).toBe("Other");
  });
});

// ---------------------------------------------------------------------------
// Pair inference
// ---------------------------------------------------------------------------

describe("enrichSpec — pair inference", () => {
  it("pairs X-on-dark with X", () => {
    const doc = makeDoc([
      token("primary", "#007AFF"),
      token("primary-on-dark", "#FFFFFF"),
    ]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.pair).toBe("primary-on-dark");
    expect(doc.spec.colorTokens![1]!.pair).toBe("primary");
  });

  it("pairs X-dark with X", () => {
    const doc = makeDoc([
      token("surface", "#FFFFFF"),
      token("surface-dark", "#1C1C1E"),
    ]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.pair).toBe("surface-dark");
    expect(doc.spec.colorTokens![1]!.pair).toBe("surface");
  });

  it("pairs on-X with X", () => {
    const doc = makeDoc([
      token("surface", "#FFFFFF"),
      token("on-surface", "#1C1C1E"),
    ]);
    enrichSpec(doc);
    const surface = doc.spec.colorTokens!.find((t) => t.name === "surface");
    const onSurface = doc.spec.colorTokens!.find((t) => t.name === "on-surface");
    expect(surface!.pair).toBe("on-surface");
    expect(onSurface!.pair).toBe("surface");
  });

  it("pairs X-light with X", () => {
    const doc = makeDoc([
      token("background", "#1C1C1E"),
      token("background-light", "#FFFFFF"),
    ]);
    enrichSpec(doc);
    expect(doc.spec.colorTokens![0]!.pair).toBe("background-light");
    expect(doc.spec.colorTokens![1]!.pair).toBe("background");
  });

  it("handles color- prefix in pair matching", () => {
    const doc = makeDoc([
      token("color-surface", "#FFFFFF"),
      token("color-on-surface", "#1C1C1E"),
    ]);
    enrichSpec(doc);
    const surface = doc.spec.colorTokens!.find((t) => t.name === "color-surface");
    const onSurface = doc.spec.colorTokens!.find((t) => t.name === "color-on-surface");
    expect(surface!.pair).toBe("color-on-surface");
    expect(onSurface!.pair).toBe("color-surface");
  });

  it("pairs by luminance contrast with shared name fragment", () => {
    const doc = makeDoc([
      token("brand-base", "#0A0A0A"),   // near-black, lum ≈ 0.003
      token("brand-light", "#F0F0F0"),  // near-white, lum ≈ 0.87
    ]);
    enrichSpec(doc);
    const base = doc.spec.colorTokens!.find((t) => t.name === "brand-base");
    const light = doc.spec.colorTokens!.find((t) => t.name === "brand-light");
    // These share the "brand" fragment and have high luminance contrast (> 0.5)
    expect(base!.pair).toBe("brand-light");
    expect(light!.pair).toBe("brand-base");
  });

  it("does not pair unrelated tokens with low contrast", () => {
    const doc = makeDoc([
      token("red-a", "#FF0000"),
      token("blue-b", "#0000FF"),
    ]);
    enrichSpec(doc);
    // No shared name fragment (length > 2)
    expect(doc.spec.colorTokens![0]!.pair).toBeUndefined();
    expect(doc.spec.colorTokens![1]!.pair).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Font availability
// ---------------------------------------------------------------------------

describe("enrichSpec — font availability", () => {
  it("does not emit diagnostic for a known font (CSS format)", () => {
    const doc = makeDoc([]);
    doc.spec.typographyTokens = [
      { name: "display", value: 'family:"Poppins", sans-serif', provenance: { extractor: "test" } },
    ];
    enrichSpec(doc);
    expect(doc.diagnostics.filter((d) => d.token === "font-unavailable")).toHaveLength(0);
  });

  it("does not emit diagnostic for a known font (YAML JSON format)", () => {
    const doc = makeDoc([]);
    doc.spec.typographyTokens = [
      {
        name: "body",
        value: JSON.stringify({ "font-family": '"Inter", sans-serif', "font-size": "16px" }),
        provenance: { extractor: "test" },
      },
    ];
    enrichSpec(doc);
    expect(doc.diagnostics.filter((d) => d.token === "font-unavailable")).toHaveLength(0);
  });

  it("emits diagnostic for unknown font", () => {
    const doc = makeDoc([]);
    doc.spec.typographyTokens = [
      { name: "display", value: 'family:"UnknownFont", sans-serif', provenance: { extractor: "test" } },
    ];
    enrichSpec(doc);
    const diags = doc.diagnostics.filter((d) => d.token === "font-unavailable");
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain("UnknownFont");
  });

  it("accepts SF Pro variants via prefix match", () => {
    const doc = makeDoc([]);
    doc.spec.typographyTokens = [
      { name: "hero", value: 'family:"SF Pro Display", system-ui', provenance: { extractor: "test" } },
    ];
    enrichSpec(doc);
    expect(doc.diagnostics.filter((d) => d.token === "font-unavailable")).toHaveLength(0);
  });

  it("skips generic families (sans-serif, system-ui, etc.)", () => {
    const doc = makeDoc([]);
    doc.spec.typographyTokens = [
      { name: "body", value: "family:sans-serif", provenance: { extractor: "test" } },
      { name: "code", value: "family:monospace", provenance: { extractor: "test" } },
    ];
    enrichSpec(doc);
    expect(doc.diagnostics.filter((d) => d.token === "font-unavailable")).toHaveLength(0);
  });

  it("suppresses diagnostic when Substitute field exists in raw data", () => {
    const doc = makeDoc([]);
    doc.spec.typographyTokens = [
      {
        name: "display",
        value: JSON.stringify({
          "font-family": '"ObscureFont", serif',
          "font-size": "32px",
          Substitute: "Georgia",
        }),
        provenance: { extractor: "test" },
      },
    ];
    enrichSpec(doc);
    expect(doc.diagnostics.filter((d) => d.token === "font-unavailable")).toHaveLength(0);
  });

  it("suppresses diagnostic when Substitute field exists in spec.raw", () => {
    const doc = makeDoc([]);
    doc.spec.typographyTokens = [
      { name: "display", value: 'family:"ObscureFont", serif', provenance: { extractor: "test" } },
    ];
    doc.spec.raw = {
      typography: {
        display: { "font-family": '"ObscureFont", serif', Substitute: "Georgia" },
      },
    };
    enrichSpec(doc);
    expect(doc.diagnostics.filter((d) => d.token === "font-unavailable")).toHaveLength(0);
  });

  it("does not emit duplicate diagnostics for the same font", () => {
    const doc = makeDoc([]);
    doc.spec.typographyTokens = [
      { name: "heading", value: 'family:"ObscureFont", sans-serif', provenance: { extractor: "test" } },
      { name: "body", value: 'family:"ObscureFont", sans-serif', provenance: { extractor: "test" } },
    ];
    enrichSpec(doc);
    expect(doc.diagnostics.filter((d) => d.token === "font-unavailable")).toHaveLength(1);
  });

  it("allows all fonts in the curated list", () => {
    const allFonts = [
      "Inter", "Poppins", "Nunito", "IBM Plex Sans", "IBM Plex Mono",
      "DM Sans", "Space Mono", "General Sans", "Sohne", "JetBrains Mono", "SF Pro",
    ];
    const doc = makeDoc([]);
    doc.spec.typographyTokens = allFonts.map((f, i) => ({
      name: `t${i}`,
      value: `family:"${f}", sans-serif`,
      provenance: { extractor: "test" },
    }));
    enrichSpec(doc);
    expect(doc.diagnostics.filter((d) => d.token === "font-unavailable")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration — dylanbrouwer fixture
// ---------------------------------------------------------------------------

describe("enrichSpec — dylanbrouwer fixture", () => {
  const content = DYLANBROUWER;
  const doc = runDesignPipeline(content);

  it("pipeline has no stage errors", () => {
    const stageErrors = doc.diagnostics.filter(
      (d) => d.severity === "error" && d.message.includes("Pipeline stage"),
    );
    expect(stageErrors).toHaveLength(0);
  });

  it("classifies Warm Mist as surface or background", () => {
    const warmMist = findToken(doc, "warm-mist");
    expect(warmMist).toBeTruthy();
    expect(warmMist!.role).toMatch(/^(surface|background)$/);
  });

  it("classifies Ink as text", () => {
    const ink = findToken(doc, "ink");
    expect(ink).toBeTruthy();
    expect(ink!.role).toBe("text");
  });

  it("classifies high-saturation terracotta as brand", () => {
    const terracotta = findToken(doc, "terracotta");
    expect(terracotta).toBeTruthy();
    expect(terracotta!.role).toMatch(/^(brand|accent)$/);
  });

  it("classifies muted stone as text-muted", () => {
    const muted = findToken(doc, "muted-stone");
    expect(muted).toBeTruthy();
    expect(muted!.role).toBe("text-muted");
  });

  it("assigns groups to all tokens", () => {
    for (const t of doc.spec.colorTokens ?? []) {
      expect(t.group).toBeDefined();
    }
  });

  it("emits font-unavailable diagnostic for Signifier", () => {
    const diags = doc.diagnostics.filter((d) => d.token === "font-unavailable");
    expect(diags.some((d) => d.message.includes("Signifier"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration — apple-style naming pair inference
// ---------------------------------------------------------------------------

describe("enrichSpec — apple-style pair inference", () => {
  it("pairs primary-on-dark with primary", () => {
    const doc = makeDoc([
      token("primary", "#007AFF"),
      token("primary-on-dark", "#FFFFFF"),
    ]);
    enrichSpec(doc);
    const primary = doc.spec.colorTokens!.find((t) => t.name === "primary");
    const onDark = doc.spec.colorTokens!.find((t) => t.name === "primary-on-dark");
    expect(primary!.pair).toBe("primary-on-dark");
    expect(onDark!.pair).toBe("primary");
  });

  it("pairs color-on-surface with color-surface", () => {
    const doc = makeDoc([
      token("color-surface", "#FFFFFF"),
      token("color-on-surface", "#1C1C1E"),
    ]);
    enrichSpec(doc);
    const surface = doc.spec.colorTokens!.find((t) => t.name === "color-surface");
    const onSurface = doc.spec.colorTokens!.find((t) => t.name === "color-on-surface");
    expect(surface!.pair).toBe("color-on-surface");
    expect(onSurface!.pair).toBe("color-surface");
  });
});
