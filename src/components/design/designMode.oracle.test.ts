import { describe, expect, it } from "vitest";
import { runDesignPipeline } from "../../parser/design/pipeline";
import { detectDesignDocumentCheap } from "../../parser/design/detectCheap";
import { buildShowcaseCSS } from "./showcaseTheme";
import APPLE from "../../../samples/apple-DESIGN.md?raw";
import SHOPVIBE from "../../../samples/shopvibe-DESIGN.md?raw";
import THOUGHTSTREAM from "../../../samples/thoughtstream-DESIGN.md?raw";
import DYLANBROUWER from "../../../samples/dylanbrouwer-DESIGN.md?raw";
import TOKENLESS from "../../../samples/pranayama_library.md?raw";
import NYX from "../../../samples/nyx-DESIGN.md?raw";

const DESIGN_SAMPLES = [
  { name: "apple", content: APPLE, filename: "apple-DESIGN.md" },
  { name: "shopvibe", content: SHOPVIBE, filename: "shopvibe-DESIGN.md" },
  { name: "thoughtstream", content: THOUGHTSTREAM, filename: "thoughtstream-DESIGN.md" },
  { name: "dylanbrouwer", content: DYLANBROUWER, filename: "dylanbrouwer-DESIGN.md" },
  { name: "nyx", content: NYX, filename: "nyx-DESIGN.md" },
] as const;

const VAR_MAPPING: Record<string, string> = {
  "--bg": "--nyx-bg",
  "--surface": "--nyx-surface",
  "--accent": "--nyx-accent",
  "--accent-hover": "--nyx-accent-hover",
  "--accent-bg": "--nyx-accent-bg",
  "--positive": "--nyx-positive",
  "--positive-bg": "--nyx-positive-bg",
  "--warning": "--nyx-warning",
  "--warning-bg": "--nyx-warning-bg",
  "--error": "--nyx-error",
  "--text-head": "--nyx-text-head",
  "--text-body": "--nyx-text-body",
  "--text-muted": "--nyx-text-muted",
  "--text-dim": "--nyx-text-dim",
  "--sep": "--nyx-sep",
  "--surface-elevated": "--nyx-surface-elevated",
  "--callout-bg": "--nyx-callout-bg",
  "--callout-text": "--nyx-callout-text",
  "--neutral-bg": "--nyx-neutral-bg",
  "--neutral-text": "--nyx-neutral-text",
  "--tag-neutral-bg": "--nyx-tag-neutral-bg",
  "--hover-bg": "--nyx-hover-bg",
  "--on-accent": "--nyx-btn-primary-text",
  "--highlight-border": "--nyx-card-highlight-border",
  "--input-bg": "--nyx-input-bg",
  "--input-border": "--nyx-input-border",
  "--input-focus-ring": "--nyx-input-focus-ring",
  "--radius-button": "--nyx-radius-btn",
  "--radius-card": "--nyx-radius-card",
  "--radius-input": "--nyx-radius-input",
  "--radius-badge": "--nyx-radius-badge",
  "--radius-tag": "--nyx-radius-tag",
  "--radius-table": "--nyx-radius-table",
  "--radius-callout": "--nyx-radius-callout",
  "--input-height": "--nyx-input-height",
  "--input-padding": "--nyx-input-padding",
  "--input-font-size": "--nyx-input-font-size",
  "--input-font-weight": "--nyx-input-font-weight",
  "--card-padding": "--nyx-card-padding",
};

function extractRootCssVars(html: string): Map<string, string> {
  const rootMatch = html.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootMatch) return new Map();
  const vars = new Map<string, string>();
  const decls = rootMatch[1]!;
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(decls)) !== null) {
    vars.set(m[1]!, m[2]!.trim());
  }
  return vars;
}

function extractShowcaseCssVars(css: string, theme: "light" | "dark" | "base"): Map<string, string> {
  let block: string | undefined;
  if (theme === "base") {
    const match = css.match(/\.nyx-showcase,[^{}]*\{([^}]*)\}/);
    block = match?.[1];
  } else {
    const re = new RegExp(`\\[data-theme="${theme}"\\][^{]*\\{([^}]*)\\}`);
    const match = css.match(re);
    block = match?.[1];
  }
  if (!block) return new Map();
  const vars = new Map<string, string>();
  const declRe = /(--nyx-[\w-]+)\s*:\s*([^;]+?)(?:;|$)/g;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(block)) !== null) {
    vars.set(m[1]!, m[2]!.trim());
  }
  return vars;
}

function normalizeColor(value: string): string {
  const trimmed = value.trim().toLowerCase();

  const hex = trimmed.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    const h = hex[1]!;
    if (h.length === 3) {
      const r = parseInt(h[0]! + h[0], 16);
      const g = parseInt(h[1]! + h[1], 16);
      const b = parseInt(h[2]! + h[2], 16);
      return `rgb(${r},${g},${b})`;
    }
    if (h.length === 4) {
      const r = parseInt(h[0]! + h[0], 16);
      const g = parseInt(h[1]! + h[1], 16);
      const b = parseInt(h[2]! + h[2], 16);
      const a = parseInt(h[3]! + h[3], 16) / 255;
      return `rgba(${r},${g},${b},${normalizeAlpha(a)})`;
    }
    if (h.length === 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgb(${r},${g},${b})`;
    }
    if (h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = parseInt(h.slice(6, 8), 16) / 255;
      return `rgba(${r},${g},${b},${normalizeAlpha(a)})`;
    }
  }

  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (rgb) {
    const r = parseInt(rgb[1]!);
    const g = parseInt(rgb[2]!);
    const b = parseInt(rgb[3]!);
    const a = rgb[4] !== undefined ? parseFloat(rgb[4]!) : 1;
    if (rgb[0]!.startsWith("rgba") || rgb[4] !== undefined) {
      return `rgba(${r},${g},${b},${normalizeAlpha(a)})`;
    }
    return `rgb(${r},${g},${b})`;
  }

  return trimmed;
}

function normalizeAlpha(a: number): string {
  const rounded = Math.round(a * 100) / 100;
  if (rounded === 0) return "0";
  if (rounded === 1) return "1";
  const str = String(rounded);
  return str;
}

function normalizeNonColorValue(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const normalized = trimmed.replace(/\s+/g, " ");
  const pxMatch = normalized.match(/^(-?[\d.]+)px$/);
  if (pxMatch) {
    const num = parseFloat(pxMatch[1]!);
    if (num === 0) return "0px";
    return `${num}px`;
  }
  return normalized;
}

function normalizeValue(value: string, varName: string): string {
  const isColorVar = varName.includes("bg") || varName.includes("text") || varName.includes("sep") ||
    varName.includes("accent") || varName.includes("positive") || varName.includes("warning") ||
    varName.includes("error") || varName.includes("surface") || varName.includes("hover") ||
    varName.includes("border") || varName.includes("ring") || varName.includes("on-") ||
    varName === "--nyx-btn-primary-text" || varName === "--nyx-highlight-border" ||
    varName === "--nyx-input-border" || varName === "--nyx-input-focus-ring" ||
    varName === "--nyx-card-highlight-border";

  if (isColorVar) {
    const borderMatch = value.match(/^(\d+(?:\.\d+)?(?:px|em|rem)?)\s+(solid|dashed|dotted)?\s+(.+)$/i);
    if (borderMatch) {
      const width = borderMatch[1]!;
      const style = borderMatch[2] ? ` ${borderMatch[2]}` : "";
      const color = normalizeColor(borderMatch[3]!);
      return `${width}${style} ${color}`;
    }
    const ringMatch = value.match(/^(.+?)\s+(#[0-9a-f]+|rgba?\([^)]+\))$/i);
    if (ringMatch && isColorLike(ringMatch[2]!)) {
      const prefix = normalizeNonColorValue(ringMatch[1]!);
      const color = normalizeColor(ringMatch[2]!);
      return `${prefix} ${color}`;
    }
    if (isColorLike(value)) {
      return normalizeColor(value);
    }
  }

  return normalizeNonColorValue(value);
}

function isColorLike(value: string): boolean {
  const trimmed = value.trim();
  if (/^#([0-9a-f]{3,8})$/i.test(trimmed)) return true;
  if (/^rgba?\(/i.test(trimmed)) return true;
  return false;
}

function compareVars(
  expectedVars: Map<string, string>,
  showcaseVars: Map<string, string>,
  sampleName: string,
  theme: string,
): string[] {
  const failures: string[] = [];

  for (const [expectedVar, expectedValue] of expectedVars) {
    const showcaseVar = VAR_MAPPING[expectedVar];
    if (!showcaseVar) continue;

    const actualValue = showcaseVars.get(showcaseVar);
    if (actualValue === undefined) {
      failures.push(`${expectedVar} -> ${showcaseVar}: missing in ${theme} showcase`);
      continue;
    }

    const normalizedExpected = normalizeValue(expectedValue, showcaseVar);
    const normalizedActual = normalizeValue(actualValue, showcaseVar);

    if (normalizedExpected !== normalizedActual) {
      failures.push(
        `${expectedVar} -> ${showcaseVar}: expected "${normalizedExpected}", got "${normalizedActual}"`,
      );
    }
  }

  return failures;
}

function extractColorVarsOnly(vars: Map<string, string>): Map<string, string> {
  const colorVarNames = new Set([
    "--bg", "--surface", "--accent", "--accent-hover", "--accent-bg",
    "--positive", "--positive-bg", "--warning", "--warning-bg", "--error",
    "--text-head", "--text-body", "--text-muted", "--text-dim",
    "--sep", "--surface-elevated", "--callout-bg", "--callout-text",
    "--neutral-bg", "--neutral-text", "--tag-neutral-bg", "--hover-bg",
    "--on-accent", "--highlight-border", "--input-bg", "--input-border",
    "--input-focus-ring",
  ]);
  const result = new Map<string, string>();
  for (const [key, value] of vars) {
    if (colorVarNames.has(key)) {
      result.set(key, value);
    }
  }
  return result;
}

function colorMetrics(value: string | undefined): { luminance: number; alpha: number } | null {
  if (!value) return null;
  const normalized = normalizeColor(value);
  const rgb = normalized.match(/^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/);
  if (!rgb) return null;
  const r = parseInt(rgb[1]!);
  const g = parseInt(rgb[2]!);
  const b = parseInt(rgb[3]!);
  const alpha = rgb[4] !== undefined ? parseFloat(rgb[4]!) : 1;
  return { luminance: 0.299 * r + 0.587 * g + 0.114 * b, alpha };
}

function expectThemeColorPolarity(
  value: string | undefined,
  theme: "light" | "dark",
  label: string,
  options?: { allowTransparentInDark?: boolean },
): void {
  const metrics = colorMetrics(value);
  expect(metrics, `${label} should be a parseable CSS color`).not.toBeNull();
  if (!metrics) return;

  if (metrics.alpha < 0.5) {
    expect(theme === "dark" && options?.allowTransparentInDark, `${label} should not be a low-alpha light overlay`).toBe(true);
    return;
  }

  if (theme === "dark") {
    expect(metrics.luminance, `${label} should be dark in dark theme`).toBeLessThan(140);
  } else {
    expect(metrics.luminance, `${label} should be light in light theme`).toBeGreaterThanOrEqual(128);
  }
}

function expectReadableTextPolarity(
  value: string | undefined,
  theme: "light" | "dark",
  label: string,
): void {
  const metrics = colorMetrics(value);
  expect(metrics, `${label} should be a parseable CSS color`).not.toBeNull();
  if (!metrics || metrics.alpha < 0.5) return;

  if (theme === "dark") {
    expect(metrics.luminance, `${label} should be readable on dark backgrounds`).toBeGreaterThanOrEqual(128);
  } else {
    expect(metrics.luminance, `${label} should be readable on light backgrounds`).toBeLessThan(140);
  }
}

describe("Design Mode sample oracle", () => {
  for (const sample of DESIGN_SAMPLES) {
    describe(`sample: ${sample.name}`, () => {
      it("generates non-null showcase CSS for design sample", () => {
        const doc = runDesignPipeline(sample.content);
        const css = buildShowcaseCSS(doc);
        expect(css).not.toBeNull();
        expect(css!.length).toBeGreaterThan(100);
      });

      it("has critical --nyx-* variables in generated showcase CSS", () => {
        const doc = runDesignPipeline(sample.content);
        const css = buildShowcaseCSS(doc);
        expect(css).not.toBeNull();

        const presentVars = extractCssVars(css!);
        expect(presentVars.size, "Should have multiple --nyx-* vars").toBeGreaterThan(5);
      });

      it("contains no unresolved {token.name} references in showcase CSS", () => {
        const doc = runDesignPipeline(sample.content);
        const css = buildShowcaseCSS(doc);
        if (css === null) return;

        const unresolvedRefs = findUnresolvedTokenRefs(css);
        expect(
          unresolvedRefs,
          `Found unresolved token references: ${unresolvedRefs.join(", ")}`,
        ).toEqual([]);
      });

      it("produces identical showcase CSS on repeated pipeline runs (determinism)", () => {
        const doc1 = runDesignPipeline(sample.content);
        const css1 = buildShowcaseCSS(doc1);

        const doc2 = runDesignPipeline(sample.content);
        const css2 = buildShowcaseCSS(doc2);

        expect(css1).toBe(css2);
      });

      it("produces identical showcase CSS on same document object (referential stability)", () => {
        const doc = runDesignPipeline(sample.content);
        const css1 = buildShowcaseCSS(doc);
        const css2 = buildShowcaseCSS(doc);

        expect(css1).toBe(css2);
      });

      it("score from detectDesignDocumentCheap exceeds threshold for design sample", () => {
        const detection = detectDesignDocumentCheap(sample.content, sample.filename);
        expect(detection.score).toBeGreaterThanOrEqual(detection.threshold);
      });
    });
  }

  describe("tokenless sample (pranayama_library)", () => {
    it("is NOT detected as a design-token showcase by detectDesignDocumentCheap", () => {
      const detection = detectDesignDocumentCheap(TOKENLESS, "pranayama_library.md");

      expect(detection.score, "Tokenless sample should score below threshold").toBeLessThan(detection.threshold);
    });

    it("produces null showcase CSS from the pipeline", () => {
      const doc = runDesignPipeline(TOKENLESS);
      const css = buildShowcaseCSS(doc);

      expect(css).toBeNull();
    });

    it("has zero color tokens in the pipeline output", () => {
      const doc = runDesignPipeline(TOKENLESS);

      expect(doc.spec.colorTokens?.length ?? 0).toBe(0);
    });

    it("has zero typography tokens in the pipeline output", () => {
      const doc = runDesignPipeline(TOKENLESS);

      expect(doc.spec.typographyTokens?.length ?? 0).toBe(0);
    });
  });
});

describe("Design Mode showcase CSS variable guardrails", () => {
  for (const sample of DESIGN_SAMPLES) {
    describe(`sample: ${sample.name}`, () => {
      for (const theme of ["light", "dark"] as const) {
        it(`keeps ${theme} CSS variables visually plausible`, () => {
          const doc = runDesignPipeline(sample.content);
          const css = buildShowcaseCSS(doc);
          expect(css).not.toBeNull();

          const showcaseVars = extractShowcaseCssVars(css!, theme === "light" ? "light" : "dark");

          for (const varName of [
            "--nyx-bg",
            "--nyx-surface",
            "--nyx-accent",
            "--nyx-accent-hover",
            "--nyx-text-head",
            "--nyx-text-body",
            "--nyx-sep",
          ]) {
            expect(showcaseVars.has(varName), `${sample.name} ${theme} should emit ${varName}`).toBe(true);
          }

          expectThemeColorPolarity(showcaseVars.get("--nyx-bg"), theme, `${sample.name} ${theme} bg`);
          expectThemeColorPolarity(
            showcaseVars.get("--nyx-surface"),
            theme,
            `${sample.name} ${theme} surface`,
            { allowTransparentInDark: true },
          );
          expectReadableTextPolarity(showcaseVars.get("--nyx-text-head"), theme, `${sample.name} ${theme} text-head`);
          expectReadableTextPolarity(showcaseVars.get("--nyx-text-body"), theme, `${sample.name} ${theme} text-body`);

          const cssText = [...showcaseVars.entries()].map(([key, value]) => `${key}:${value}`).join(";");
          expect(cssText, `${sample.name} ${theme} should not contain unresolved token references`).not.toMatch(/\{[^}]+\}/);

          const hover = showcaseVars.get("--nyx-accent-hover");
          expect(hover, `${sample.name} ${theme} should emit accent hover`).toBeDefined();
          if (hover) {
            expect(hover, `${sample.name} ${theme} should not fall back to the default nyx blue hover`).not.toBe("#38bdf8");
          }
        });
      }
    });
  }
});

describe("Design Mode stability", () => {
  for (const sample of DESIGN_SAMPLES) {
    it(`pipeline output is deterministic for ${sample.name}`, () => {
      const doc1 = runDesignPipeline(sample.content);
      const doc2 = runDesignPipeline(sample.content);

      expect(doc1.spec.colorTokens).toEqual(doc2.spec.colorTokens);
      expect(doc1.spec.typographyTokens).toEqual(doc2.spec.typographyTokens);
      expect(doc1.spec.radiusTokens).toEqual(doc2.spec.radiusTokens);
      expect(doc1.spec.componentRecipes).toEqual(doc2.spec.componentRecipes);
      expect(doc1.detection.score).toBe(doc2.detection.score);
    });
  }

  it("deterministicScore produces consistent results across repeated calls", () => {
    const doc = runDesignPipeline(APPLE);
    const css1 = buildShowcaseCSS(doc);
    const css2 = buildShowcaseCSS(doc);
    const css3 = buildShowcaseCSS(doc);

    expect(css1).toBe(css2);
    expect(css2).toBe(css3);
  });

  it("no Math.random or Date.now in design pipeline output (deterministic by construction)", () => {
    const doc = runDesignPipeline(SHOPVIBE);
    const css = buildShowcaseCSS(doc);

    if (css) {
      expect(css).not.toContain("Math.random");
      expect(css).not.toContain("Date.now");
    }
  });
});

function extractCssVars(css: string): Set<string> {
  const vars = new Set<string>();
  const re = /(--nyx-[a-z][-a-z0-9]*)\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    vars.add(m[1]!.toLowerCase());
  }
  return vars;
}

function findUnresolvedTokenRefs(css: string): string[] {
  const matches: string[] = [];
  const re = /\{([a-zA-Z_][\w.-]*(?:\.[\w.-]+)*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    matches.push(m[1]!);
  }
  return matches;
}
