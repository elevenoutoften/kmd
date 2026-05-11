import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  extractShadow,
  extractShadowFromContent,
} from "./shadow";

const FIXTURES = join(__dirname, "../../../../fixtures");

describe("shadow extractor", () => {
  describe("shopvibe bold-pair elevation tokens", () => {
    const content = readFileSync(join(FIXTURES, "shopvibe-DESIGN.md"), "utf-8");
    const doc = extractShadowFromContent(content);

    it("extracts all 4 elevation tokens from the Elevation section", () => {
      const tokens = doc.spec.elevationTokens;
      expect(tokens).toHaveLength(4);
    });

    it("extracts Subtle token", () => {
      const token = doc.spec.elevationTokens.find((t) => t.name === "Subtle");
      expect(token).toBeDefined();
      expect(token!.value).toBe("0 1px 2px rgba(0,0,0,0.05)");
    });

    it("extracts Medium token with comma-separated values", () => {
      const token = doc.spec.elevationTokens.find((t) => t.name === "Medium");
      expect(token).toBeDefined();
      expect(token!.value).toBe(
        "0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)",
      );
    });

    it("extracts Large token with comma-separated values", () => {
      const token = doc.spec.elevationTokens.find((t) => t.name === "Large");
      expect(token).toBeDefined();
      expect(token!.value).toBe(
        "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)",
      );
    });

    it("extracts Overlay token with comma-separated values", () => {
      const token = doc.spec.elevationTokens.find((t) => t.name === "Overlay");
      expect(token).toBeDefined();
      expect(token!.value).toBe(
        "0 20px 25px rgba(0,0,0,0.15), 0 8px 10px rgba(0,0,0,0.08)",
      );
    });

    it("sets provenance.extractor to 'shadow'", () => {
      for (const token of doc.spec.elevationTokens) {
        expect(token.provenance.extractor).toBe("shadow");
        expect(token.provenance.sourceLine).toBeGreaterThan(0);
      }
    });
  });

  describe("dylanbrouwer CSS custom properties", () => {
    const content = readFileSync(join(FIXTURES, "dylanbrouwer-DESIGN.md"), "utf-8");
    const doc = extractShadowFromContent(content);

    it("extracts shadow CSS custom properties from code blocks", () => {
      const names = doc.spec.elevationTokens.map((t) => t.name);
      // CSS block has: --shadow-subtle, --shadow-medium, --shadow-large
      // Tailwind block also has: --shadow-subtle
      // Total: 4 (subtle appears twice)
      expect(names).toContain("subtle");
      expect(names).toContain("medium");
      expect(names).toContain("large");
    });

    it("extracts correct values from CSS block", () => {
      const subtle = doc.spec.elevationTokens.find(
        (t) => t.name === "subtle" && t.value.includes("0.05"),
      );
      expect(subtle).toBeDefined();
      expect(subtle!.value).toBe("0 1px 2px rgba(0,0,0,0.05)");
    });

    it("sets provenance.extractor to 'shadow' for CSS tokens", () => {
      for (const token of doc.spec.elevationTokens) {
        expect(token.provenance.extractor).toBe("shadow");
      }
    });
  });

  describe("no shadow content", () => {
    const content = readFileSync(join(FIXTURES, "apple-DESIGN.md"), "utf-8");
    const doc = extractShadowFromContent(content);

    it("produces empty elevationTokens when no shadows found", () => {
      expect(doc.spec.elevationTokens).toHaveLength(0);
    });
  });

  describe("convenience wrapper", () => {
    it("returns a valid DesignDocument", () => {
      const doc = extractShadowFromContent(
        "## Elevation\n- **Subtle**: 0 1px 2px rgba(0,0,0,0.05) — test",
      );
      expect(doc.spec.elevationTokens).toHaveLength(1);
      expect(doc.spec.elevationTokens[0].name).toBe("Subtle");
      expect(doc.diagnostics).toHaveLength(0);
    });
  });
});
