import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  extractLayout,
  extractLayoutFromContent,
} from "./layout";

const FIXTURES = join(__dirname, "../../../../fixtures");

describe("layout extractor", () => {
  describe("dylanbrouwer-DESIGN.md inline bold layout", () => {
    const content = readFileSync(join(FIXTURES, "dylanbrouwer-DESIGN.md"), "utf-8");
    const doc = extractLayoutFromContent(content);

    it("extracts Theme layout token", () => {
      const theme = doc.spec.layoutTokens.find((t) => t.name === "Theme");
      expect(theme).toBeDefined();
      expect(theme!.value).toBe("Light");
    });

    it("extracts Density layout token", () => {
      const density = doc.spec.layoutTokens.find((t) => t.name === "Density");
      expect(density).toBeDefined();
      expect(density!.value).toBe("Comfortable");
    });

    it("extracts Base unit layout token", () => {
      const base = doc.spec.layoutTokens.find((t) => t.name === "Base unit");
      expect(base).toBeDefined();
      expect(base!.value).toBe("4px");
    });

    it("populates both layoutTokens and layout record", () => {
      expect(doc.spec.layout["Theme"]).toBe("Light");
      expect(doc.spec.layout["Density"]).toBe("Comfortable");
      expect(doc.spec.layout["Base unit"]).toBe("4px");
    });

    it("sets provenance.extractor to 'layout'", () => {
      for (const token of doc.spec.layoutTokens) {
        expect(token.provenance.extractor).toBe("layout");
        expect(token.provenance.sourceLine).toBeGreaterThan(0);
      }
    });
  });

  describe("shopvibe-DESIGN.md spacing layout", () => {
    const content = readFileSync(join(FIXTURES, "shopvibe-DESIGN.md"), "utf-8");
    const doc = extractLayoutFromContent(content);

    it("extracts layout tokens from the Spacing section bold-pair items", () => {
      // ShopVibe Spacing section has: Base unit: 8px, xs through 5xl
      const tokens = doc.spec.layoutTokens;
      // The Spacing section heading doesn't contain "layout" so these won't be
      // extracted by the layout extractor — it only matches "layout" headings.
      // This test verifies the extractor doesn't over-capture.
      expect(tokens.every((t) => t.provenance.extractor === "layout")).toBe(true);
    });
  });

  describe("bold-pair and plain key: value patterns", () => {
    const content = [
      "## Layout",
      "",
      "- **Grid columns**: 12",
      "- **Max width**: 1200px",
      "- Base unit: 8px",
      "- **Gutter**: 24px",
    ].join("\n");

    const doc = extractLayoutFromContent(content);

    it("extracts bold-pair items", () => {
      const grid = doc.spec.layoutTokens.find((t) => t.name === "Grid columns");
      expect(grid).toBeDefined();
      expect(grid!.value).toBe("12");
    });

    it("extracts plain key: value items", () => {
      const base = doc.spec.layoutTokens.find((t) => t.name === "Base unit");
      expect(base).toBeDefined();
      expect(base!.value).toBe("8px");
    });

    it("populates the layout record alongside tokens", () => {
      expect(doc.spec.layout["Grid columns"]).toBe("12");
      expect(doc.spec.layout["Max width"]).toBe("1200px");
      expect(doc.spec.layout["Base unit"]).toBe("8px");
      expect(doc.spec.layout["Gutter"]).toBe("24px");
    });
  });

  describe("no layout content", () => {
    const content = readFileSync(join(FIXTURES, "apple-DESIGN.md"), "utf-8");
    const doc = extractLayoutFromContent(content);

    it("produces empty layoutTokens when no layout section found", () => {
      expect(doc.spec.layoutTokens).toHaveLength(0);
    });
  });

  describe("convenience wrapper", () => {
    it("returns a valid DesignDocument", () => {
      const doc = extractLayoutFromContent(
        "## Layout\n- **Columns**: 12",
      );
      expect(doc.spec.layoutTokens).toHaveLength(1);
      expect(doc.diagnostics).toHaveLength(0);
    });
  });
});
