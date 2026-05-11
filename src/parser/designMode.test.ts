import { describe, expect, it } from "vitest";
import ROOT_DESIGN from "../../DESIGN.md?raw";
import SAMPLE_MARKDOWN from "../../fixtures/sample.md?raw";
import {
  hasDesignTokens,
  parseProseDesignSpec,
  runDesignPipeline,
  summarizeMarkdownForDesignMode,
} from "./design";

describe("design mode content selection", () => {
  it("detects design-token documents from their own content", () => {
    expect(hasDesignTokens(ROOT_DESIGN)).toBe(true);
    expect(hasDesignTokens(SAMPLE_MARKDOWN)).toBe(false);
  });

  it("summarizes ordinary markdown documents instead of falling back to static sample content", () => {
    const summary = summarizeMarkdownForDesignMode(SAMPLE_MARKDOWN);

    expect(summary.title).toBe("kmd Markdown Showcase");
    expect(summary.excerpt).toContain("visual fixture for the Markdown reader");
    expect(summary.headings).toContain("Task List");
    expect(summary.stats.listCount).toBeGreaterThan(3);
    expect(summary.stats.wordCount).toBeGreaterThan(20);
  });

  it("uses YAML metadata for structured design docs instead of leaking front matter into the title", () => {
    const summary = summarizeMarkdownForDesignMode(ROOT_DESIGN);

    expect(summary.title).toBe("kmd");
    expect(summary.excerpt).toContain("Premium desktop-first Markdown reader");
  });

  it("accepts structured token docs without requiring kmd-specific token names", () => {
    const appleLike = `---
name: Apple
colors:
  primary: "#0066cc"
  canvas: "#ffffff"
  ink: "#1d1d1f"
typography:
  body:
    fontFamily: "SF Pro Text, system-ui, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.47
rounded:
  full: 9999px
spacing:
  md: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
---`;

    const doc = runDesignPipeline(appleLike);
    const { spec } = doc;

    expect(spec.colors.primary).toBe("#0066cc");
    expect(spec.typography.body).toContain('"fontSize":"17px"');
    expect(doc.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toHaveLength(0);
  });

  it("recognizes prose design specs and extracts meaningful sections", () => {
    const proseSpec = parseProseDesignSpec(`# ShopVibe

## Overview

Conversion-focused storefront design system.

## Colors

- Primary: #D946EF
- Secondary: #22D3EE

## Components

### Buttons

**Primary** - Filled pink CTA with pill radius.
`);

    expect(proseSpec).not.toBeNull();
    expect(proseSpec?.title).toBe("ShopVibe");
    expect(proseSpec?.sections.map((section) => section.title)).toContain("Colors");
    expect(proseSpec?.sections.find((section) => section.title === "Colors")?.entries[0]).toBe("Primary: #D946EF");
    expect(proseSpec?.sections.find((section) => section.title === "Components")?.subsections[0]?.title).toBe("Buttons");
    expect(proseSpec?.sections.find((section) => section.title === "Components")?.subsections[0]?.entries[0]).toBe("Primary - Filled pink CTA with pill radius.");
  });
});
