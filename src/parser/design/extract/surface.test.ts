import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  extractSurface,
  extractSurfaceFromContent,
} from "./surface";

const FIXTURES = join(__dirname, "../../../../fixtures");

describe("surface extractor", () => {
  describe("dylanbrouwer-DESIGN.md surfaces table", () => {
    const content = readFileSync(join(FIXTURES, "dylanbrouwer-DESIGN.md"), "utf-8");
    const doc = extractSurfaceFromContent(content);

    it("extracts 4 surface tokens from the Surfaces table", () => {
      const tokens = doc.spec.surfaceTokens;
      expect(tokens).toHaveLength(4);
    });

    it("extracts Canvas surface (level 1)", () => {
      const canvas = doc.spec.surfaceTokens.find((t) => t.name === "Canvas");
      expect(canvas).toBeDefined();
      expect(canvas!.value).toBe("#ffffff");
    });

    it("extracts Fog surface (level 2)", () => {
      const fog = doc.spec.surfaceTokens.find((t) => t.name === "Fog");
      expect(fog).toBeDefined();
      expect(fog!.value).toBe("#f7f7f8");
    });

    it("extracts Warm Mist surface (level 3)", () => {
      const warm = doc.spec.surfaceTokens.find((t) => t.name === "Warm Mist");
      expect(warm).toBeDefined();
      expect(warm!.value).toBe("#fbe1d1");
    });

    it("extracts Card Surface (level 4)", () => {
      const card = doc.spec.surfaceTokens.find((t) => t.name === "Card Surface");
      expect(card).toBeDefined();
      expect(card!.value).toBe("#fdfdfd");
    });

    it("sets provenance.extractor to 'surface'", () => {
      for (const token of doc.spec.surfaceTokens) {
        expect(token.provenance.extractor).toBe("surface");
        expect(token.provenance.sourceLine).toBeGreaterThan(0);
      }
    });
  });

  describe("no surface content", () => {
    const content = readFileSync(join(FIXTURES, "apple-DESIGN.md"), "utf-8");
    const doc = extractSurfaceFromContent(content);

    it("produces empty surfaceTokens when no surfaces found", () => {
      expect(doc.spec.surfaceTokens).toHaveLength(0);
    });
  });

  describe("prose bold-pair surface extraction", () => {
    const content = [
      "## Surfaces",
      "",
      "- **Base**: #ffffff — primary background",
      "- **Raised**: #f5f5f5 — elevated cards",
    ].join("\n");

    const doc = extractSurfaceFromContent(content);

    it("extracts surface tokens from bold-pair list items", () => {
      expect(doc.spec.surfaceTokens).toHaveLength(2);
    });

    it("extracts correct names and values", () => {
      const base = doc.spec.surfaceTokens.find((t) => t.name === "Base");
      expect(base).toBeDefined();
      expect(base!.value).toBe("#ffffff");
    });
  });

  describe("convenience wrapper", () => {
    it("returns a valid DesignDocument", () => {
      const doc = extractSurfaceFromContent(
        "## Surfaces\n- **Base**: #ffffff — test",
      );
      expect(doc.spec.surfaceTokens).toHaveLength(1);
      expect(doc.diagnostics).toHaveLength(0);
    });
  });
});
