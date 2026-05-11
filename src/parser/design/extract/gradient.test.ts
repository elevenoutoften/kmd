import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  extractGradient,
  extractGradientFromContent,
} from "./gradient";

const FIXTURES = join(__dirname, "../../../../fixtures");

describe("gradient extractor", () => {
  describe("synthetic gradient parsing", () => {
    const content = [
      "## Gradients",
      "",
      "- **Hero**: linear-gradient(135deg, #D946EF 0%, #22D3EE 100%) — main hero",
      "- **Accent**: radial-gradient(circle at center, #FACC15, #D946EF) — accent bg",
      "",
      "```css",
      ":root {",
      "  --gradient-warm: linear-gradient(to right, #FF6B6B, #FFE66D);",
      "}",
      "```",
    ].join("\n");

    const doc = extractGradientFromContent(content);

    it("extracts linear-gradient from prose", () => {
      const hero = doc.spec.gradientTokens.find(
        (t) => t.name === "Hero",
      );
      expect(hero).toBeDefined();
      expect(hero!.value).toContain("linear-gradient");
      expect(hero!.value).toContain("#D946EF");
      expect(hero!.value).toContain("#22D3EE");
    });

    it("parses color stops from linear-gradient", () => {
      const hero = doc.spec.gradientTokens.find(
        (t) => t.name === "Hero",
      );
      expect(hero).toBeDefined();
      expect(hero!.stops).toBeDefined();
      expect(hero!.stops!.length).toBe(2);
      expect(hero!.stops![0].color).toBe("#D946EF");
      expect(hero!.stops![0].position).toBe("0%");
      expect(hero!.stops![1].color).toBe("#22D3EE");
      expect(hero!.stops![1].position).toBe("100%");
    });

    it("extracts radial-gradient from prose", () => {
      const accent = doc.spec.gradientTokens.find(
        (t) => t.name === "Accent",
      );
      expect(accent).toBeDefined();
      expect(accent!.value).toContain("radial-gradient");
    });

    it("parses radial-gradient stops (no explicit positions)", () => {
      const accent = doc.spec.gradientTokens.find(
        (t) => t.name === "Accent",
      );
      expect(accent).toBeDefined();
      expect(accent!.stops).toBeDefined();
      expect(accent!.stops!.length).toBeGreaterThanOrEqual(2);
      const colors = accent!.stops!.map((s) => s.color);
      expect(colors).toContain("#FACC15");
      expect(colors).toContain("#D946EF");
    });

    it("extracts gradient from CSS code block with custom property name", () => {
      const warm = doc.spec.gradientTokens.find(
        (t) => t.name === "--gradient-warm",
      );
      expect(warm).toBeDefined();
      expect(warm!.value).toContain("linear-gradient");
      expect(warm!.value).toContain("#FF6B6B");
      expect(warm!.value).toContain("#FFE66D");
    });

    it("sets provenance.extractor to 'gradient'", () => {
      for (const token of doc.spec.gradientTokens) {
        expect(token.provenance.extractor).toBe("gradient");
        expect(token.provenance.sourceLine).toBeGreaterThan(0);
      }
    });
  });

  describe("no gradient content", () => {
    const content = readFileSync(join(FIXTURES, "apple-DESIGN.md"), "utf-8");
    const doc = extractGradientFromContent(content);

    it("produces empty gradientTokens when no gradients found", () => {
      expect(doc.spec.gradientTokens).toHaveLength(0);
    });
  });

  describe("convenience wrapper", () => {
    it("returns a valid DesignDocument", () => {
      const doc = extractGradientFromContent(
        "## Gradients\n- **Hero**: linear-gradient(135deg, #D946EF 0%, #22D3EE 100%)",
      );
      expect(doc.spec.gradientTokens.length).toBeGreaterThanOrEqual(1);
      expect(doc.diagnostics).toHaveLength(0);
    });
  });
});
