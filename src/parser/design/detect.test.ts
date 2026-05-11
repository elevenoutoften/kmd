import { describe, it, expect } from "vitest";
import { detectDesignDocument } from "./detect";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fixture(name: string): string {
  return readFileSync(resolve(__dirname, "../../../fixtures", name), "utf-8");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("detectDesignDocument", () => {
  // ── Real design fixtures score above threshold ───────────────────────

  describe("real design fixtures", () => {
    it("scores apple-DESIGN.md above threshold", () => {
      const content = fixture("apple-DESIGN.md");
      const result = detectDesignDocument(content, "apple-DESIGN.md");

      expect(result.score).toBeGreaterThan(result.threshold);
      // Should have filename signal.
      expect(result.signals.some((s) => s.signal.includes("Filename"))).toBe(true);
      // Should have YAML frontmatter signal.
      expect(
        result.signals.some((s) => s.signal.includes("YAML")),
      ).toBe(true);
    });

    it("scores shopvibe-DESIGN.md above threshold", () => {
      const content = fixture("shopvibe-DESIGN.md");
      const result = detectDesignDocument(content, "shopvibe-DESIGN.md");

      expect(result.score).toBeGreaterThan(result.threshold);
      // Should have filename signal.
      expect(result.signals.some((s) => s.signal.includes("Filename"))).toBe(true);
    });

    it("scores dylanbrouwer-DESIGN.md above threshold", () => {
      const content = fixture("dylanbrouwer-DESIGN.md");
      const result = detectDesignDocument(content, "dylanbrouwer-DESIGN.md");

      expect(result.score).toBeGreaterThan(result.threshold);
      // Should have filename signal and CSS block signal.
      expect(result.signals.some((s) => s.signal.includes("Filename"))).toBe(true);
      expect(result.signals.some((s) => s.signal.includes("CSS block"))).toBe(true);
    });
  });

  // ── Plain README scores below threshold ──────────────────────────────

  it("scores a plain README below threshold", () => {
    const content = readFileSync(resolve(__dirname, "../../../README.md"), "utf-8");
    const result = detectDesignDocument(content, "README.md");

    expect(result.score).toBeLessThan(result.threshold);
  });

  // ── Signals array ────────────────────────────────────────────────────

  it("lists all detected signals with positive points", () => {
    const content = fixture("apple-DESIGN.md");
    const result = detectDesignDocument(content, "apple-DESIGN.md");

    expect(result.signals.length).toBeGreaterThan(0);
    for (const s of result.signals) {
      expect(s.points).toBeGreaterThan(0);
      expect(s.signal.length).toBeGreaterThan(0);
    }
  });

  // ── Filename signal ──────────────────────────────────────────────────

  it("adds +5 for DESIGN.md filename", () => {
    // Minimal content — no tokens, no headings, no YAML.
    const content = "# Hello\n\nSome text.\n";
    const withoutFilename = detectDesignDocument(content);
    const withFilename = detectDesignDocument(content, "my-DESIGN.md");

    expect(withFilename.score).toBe(withoutFilename.score + 5);
    expect(
      withFilename.signals.some((s) => s.signal.includes("Filename")),
    ).toBe(true);
  });

  // ── Threshold is always 5 ────────────────────────────────────────────

  it("always returns threshold of 5", () => {
    const content = "# Hello\n";
    const result = detectDesignDocument(content);

    expect(result.threshold).toBe(5);
  });

  // ── Empty content scores 0 ───────────────────────────────────────────

  it("scores 0 for empty content", () => {
    const result = detectDesignDocument("", "README.md");

    expect(result.score).toBe(0);
    expect(result.signals).toEqual([]);
  });
});
