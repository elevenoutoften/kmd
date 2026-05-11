import { describe, it, expect } from "vitest";
import GFM_FIXTURE from "../../fixtures/gfm-test.md?raw";
import PERF_FIXTURE from "../../fixtures/perf-test.md?raw";
import XSS_FIXTURE from "../../fixtures/xss-test.md?raw";
import DESIGN_VALID from "../../fixtures/design-md-valid.md?raw";
import DESIGN_INVALID from "../../fixtures/design-md-invalid.md?raw";
import ROOT_DESIGN from "../../DESIGN.md?raw";
import { parseMarkdown } from "./index";
import { runDesignPipeline } from "./design";

describe("Fixture files", () => {
  it("gfm-test.md has tables, tasks, footnotes, strikethrough", () => {
    expect(GFM_FIXTURE).toContain("| Feature |");
    expect(GFM_FIXTURE).toContain("- [x]");
    expect(GFM_FIXTURE).toContain("[^1]");
    expect(GFM_FIXTURE).toContain("~~");
    expect(GFM_FIXTURE).toContain("https://github.com");
  });

  it("perf-test.md has 500+ headings", () => {
    const headingCount = (PERF_FIXTURE.match(/^#{1,6} /gm) ?? []).length;
    expect(headingCount).toBeGreaterThanOrEqual(500);
  });

  it("xss-test.md has malicious content", () => {
    expect(XSS_FIXTURE).toContain("javascript:");
    expect(XSS_FIXTURE).toContain("onerror");
  });

  it("design-md-valid.md has required tokens", () => {
    expect(DESIGN_VALID).toContain("color-on-surface");
  });

  it("design-md-invalid.md has deliberate errors", () => {
    expect(DESIGN_INVALID).toContain("not-a-color");
  });
});

describe("Parser against fixtures", () => {
  it("gfm fixture parses without throwing", async () => {
    const result = await parseMarkdown(GFM_FIXTURE);
    expect(result.html).toBeTruthy();
    expect(result.outline.length).toBeGreaterThan(0);
  });

  it("strips YAML front matter before rendering markdown body", async () => {
    const result = await parseMarkdown(`---
name: Apple
description: Quiet product storytelling
---

# Overview

Body copy here.`);

    expect(result.html).toContain("<h1");
    expect(result.html).toContain("Overview");
    expect(result.html).not.toContain("description: Quiet product storytelling");
  });

  it("perf fixture parses within reasonable time", async () => {
    const start = performance.now();
    const result = await parseMarkdown(PERF_FIXTURE);
    const elapsed = performance.now() - start;
    expect(result.html).toBeTruthy();
    expect(elapsed).toBeLessThan(5000);
  });

  it("xss fixture: script tags are sanitized", async () => {
    const result = await parseMarkdown(XSS_FIXTURE);
    expect(result.html).not.toContain("<script>");
    expect(result.html).not.toContain("onerror");
    expect(result.html).not.toContain('href="javascript:');
    expect(result.html).not.toContain('href="vbscript:');
    expect(result.html).not.toContain('href="data:text/html');
    expect(result.html).not.toContain('href="file:///');
  });

  it("xss fixture: safe links are preserved", async () => {
    const result = await parseMarkdown(XSS_FIXTURE);
    expect(result.html).toContain('href="https://example.com"');
  });
});

describe("Design parser", () => {
  it("root DESIGN.md parses front matter and token aliases", () => {
    const doc = runDesignPipeline(ROOT_DESIGN);
    const { spec } = doc;

    expect(spec.colors.tertiary).toBe("#B84E3E");
    expect(spec.typography["body-md"]).toContain('"fontSize":"17px"');
    expect(spec.radii.full).toBe("9999px");
    expect(doc.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("valid fixture parses with no errors", () => {
    const doc = runDesignPipeline(DESIGN_VALID);
    expect(doc.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("invalid fixture still parses available token data", () => {
    const doc = runDesignPipeline(DESIGN_INVALID);
    expect(doc.meta.sourceLength).toBe(DESIGN_INVALID.length);
    expect(doc.spec.raw).toBeDefined();
  });
});
