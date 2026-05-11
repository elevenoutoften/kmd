import { describe, it, expect } from "vitest";
import { extractProseFromContent } from "./prose";
import type { DesignDocument } from "../ir";
import { readFileSync } from "fs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(name: string): string {
  return readFileSync(`fixtures/${name}`, "utf-8");
}

function makeDoc(source: string): DesignDocument {
  return extractProseFromContent(source);
}

// ---------------------------------------------------------------------------
// shopvibe-DESIGN.md fixture
// ---------------------------------------------------------------------------

describe("extractProse — shopvibe-DESIGN.md", () => {
  const source = loadFixture("shopvibe-DESIGN.md");
  const doc = makeDoc(source);

  it("extracts 9 color tokens", () => {
    expect(doc.spec.colorTokens).toHaveLength(9);
  });

  it("extracts color hex values correctly", () => {
    const colors = doc.spec.colorTokens!;
    expect(colors[0]).toMatchObject({ name: "Primary", value: "#D946EF" });
    expect(colors[1]).toMatchObject({ name: "Secondary", value: "#22D3EE" });
    expect(colors[2]).toMatchObject({ name: "Tertiary", value: "#FACC15" });
    expect(colors[3]).toMatchObject({ name: "Background", value: "#FAFAFA" });
    expect(colors[4]).toMatchObject({ name: "Surface", value: "#FFFFFF" });
    expect(colors[5]).toMatchObject({
      name: "Text Primary",
      value: "#17191C",
    });
    expect(colors[6]).toMatchObject({
      name: "Text Secondary",
      value: "#6B7280",
    });
    expect(colors[7]).toMatchObject({
      name: "Text Tertiary",
      value: "#9CA3AF",
    });
    expect(colors[8]).toMatchObject({ name: "Border", value: "#E5E7EB" });
  });

  it("populates legacy colors map", () => {
    expect(doc.spec.colors["Primary"]).toBe("#D946EF");
    expect(doc.spec.colors["Border"]).toBe("#E5E7EB");
  });

  it("extracts 9 typography tokens with parsed sizes and weights", () => {
    const typo = doc.spec.typographyTokens!;
    expect(typo).toHaveLength(9);

    // Display: Poppins 56px extra-bold → 800
    const display = typo.find((t) => t.name === "Display")!;
    expect(display.value).toContain("family:Poppins");
    expect(display.value).toContain("size:56px");
    expect(display.value).toContain("weight:800");
    expect(display.value).toContain("line-height:1.1");
    expect(display.value).toContain("letter-spacing:0.02em");

    // Headline: Poppins 40px bold → 700
    const headline = typo.find((t) => t.name === "Headline")!;
    expect(headline.value).toContain("weight:700");
    expect(headline.value).toContain("size:40px");

    // Subhead: Poppins 26px semi-bold → 600
    const subhead = typo.find((t) => t.name === "Subhead")!;
    expect(subhead.value).toContain("weight:600");
    expect(subhead.value).toContain("size:26px");

    // Body Large: Nunito 18px regular → 400
    const bodyLarge = typo.find((t) => t.name === "Body Large")!;
    expect(bodyLarge.value).toContain("family:Nunito");
    expect(bodyLarge.value).toContain("weight:400");

    // Body: Nunito 16px regular → 400
    const body = typo.find((t) => t.name === "Body")!;
    expect(body.value).toContain("size:16px");
    expect(body.value).toContain("weight:400");

    // Body Small: Nunito 14px regular → 400
    const bodySmall = typo.find((t) => t.name === "Body Small")!;
    expect(bodySmall.value).toContain("size:14px");

    // Caption: Nunito 12px medium → 500
    const caption = typo.find((t) => t.name === "Caption")!;
    expect(caption.value).toContain("weight:500");
    expect(caption.value).toContain("size:12px");

    // Overline: Nunito 11px bold → 700
    const overline = typo.find((t) => t.name === "Overline")!;
    expect(overline.value).toContain("weight:700");
    expect(overline.value).toContain("letter-spacing:0.08em");

    // Code: Space Mono 14px regular → 400
    const code = typo.find((t) => t.name === "Code")!;
    expect(code.value).toContain("family:Space Mono");
    expect(code.value).toContain("weight:400");
  });

  it("extracts spacing tokens", () => {
    const spacing = doc.spec.spacingTokens!;
    expect(spacing).toHaveLength(9);
    expect(spacing[0]).toMatchObject({ name: "xs", value: "4px" });
    expect(spacing[8]).toMatchObject({ name: "5xl", value: "96px" });
  });

  it("skips non-bold list items (e.g. Base unit)", () => {
    // "Base unit: 8px" is not bold, so it should not appear as a token.
    const spacing = doc.spec.spacingTokens!;
    const base = spacing.find((t) => t.name === "Base unit");
    expect(base).toBeUndefined();
  });

  it("extracts 6 radius tokens", () => {
    const radii = doc.spec.radiusTokens!;
    expect(radii).toHaveLength(6);
    expect(radii[0]).toMatchObject({ name: "Small", value: "4px" });
    expect(radii[1]).toMatchObject({ name: "Medium", value: "12px" });
    expect(radii[2]).toMatchObject({ name: "Large", value: "16px" });
    expect(radii[3]).toMatchObject({ name: "Extra Large", value: "24px" });
    expect(radii[4]).toMatchObject({ name: "Pill", value: "9999px" });
    expect(radii[5]).toMatchObject({ name: "None", value: "0px" });
  });

  it("extracts 4 elevation tokens", () => {
    const elev = doc.spec.elevationTokens!;
    expect(elev).toHaveLength(4);
    expect(elev[0].name).toBe("Subtle");
    expect(elev[0].value).toBe("0 1px 2px rgba(0,0,0,0.05)");
    expect(elev[1].name).toBe("Medium");
    expect(elev[1].value).toContain("0 4px 6px rgba(0,0,0,0.07)");
    expect(elev[2].name).toBe("Large");
    expect(elev[3].name).toBe("Overlay");
  });

  it("extracts component recipes", () => {
    const recipes = doc.spec.componentRecipes!;
    expect(recipes.length).toBeGreaterThanOrEqual(7);
    const primary = recipes.find((r) => r.name === "Primary")!;
    expect(primary.properties.description).toContain("Fuchsia background");
  });

  it("all tokens have provenance with extractor=prose", () => {
    const allTokens = [
      ...(doc.spec.colorTokens ?? []),
      ...(doc.spec.typographyTokens ?? []),
      ...(doc.spec.spacingTokens ?? []),
      ...(doc.spec.radiusTokens ?? []),
      ...(doc.spec.elevationTokens ?? []),
    ];
    for (const token of allTokens) {
      expect(token.provenance.extractor).toBe("prose");
      expect(token.provenance.sourceLine).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Hex regex coverage
// ---------------------------------------------------------------------------

describe("extractProse — hex regex tolerance", () => {
  it("extracts #RGB hex codes", () => {
    const doc = makeDoc("## Colors\n\n- **Accent** (#F0A): bright accent");
    expect(doc.spec.colorTokens).toHaveLength(1);
    expect(doc.spec.colorTokens![0].value).toBe("#F0A");
  });

  it("extracts #RRGGBB hex codes", () => {
    const doc = makeDoc("## Colors\n\n- **Primary** (#D946EF): main");
    expect(doc.spec.colorTokens).toHaveLength(1);
    expect(doc.spec.colorTokens![0].value).toBe("#D946EF");
  });

  it("extracts #RRGGBBAA hex codes", () => {
    const doc = makeDoc(
      "## Colors\n\n- **Overlay** (#D946EF80): semi-transparent",
    );
    expect(doc.spec.colorTokens).toHaveLength(1);
    expect(doc.spec.colorTokens![0].value).toBe("#D946EF80");
  });
});

// ---------------------------------------------------------------------------
// Weight mapping
// ---------------------------------------------------------------------------

describe("extractProse — weight name → numeric mapping", () => {
  const weightCases: Array<[string, string]> = [
    ["thin", "100"],
    ["light", "300"],
    ["regular", "400"],
    ["medium", "500"],
    ["semi-bold", "600"],
    ["bold", "700"],
    ["extra-bold", "800"],
    ["black", "900"],
  ];

  for (const [name, expected] of weightCases) {
    it(`maps ${name} → ${expected}`, () => {
      const doc = makeDoc(
        `## Typography\n\n- **Test**: Test 16px ${name}, 1.5 line height.`,
      );
      expect(doc.spec.typographyTokens).toHaveLength(1);
      expect(doc.spec.typographyTokens![0].value).toContain(
        `weight:${expected}`,
      );
    });
  }
});
