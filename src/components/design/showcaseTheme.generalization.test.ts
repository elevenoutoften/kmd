import { describe, expect, it } from "vitest";
import { runDesignPipeline } from "../../parser/design/pipeline";
import { buildShowcaseCSS, parseColor, isColorDark } from "./showcaseTheme";
import MIXED_SURFACES from "../../../fixtures/design-mode/synthetic-mixed-surfaces.md?raw";
import DARK_ONLY from "../../../fixtures/design-mode/synthetic-dark-only.md?raw";
import SHARP_EDITORIAL from "../../../fixtures/design-mode/synthetic-sharp-editorial.md?raw";
import FROSTED_CARDS from "../../../fixtures/design-mode/synthetic-frosted-cards.md?raw";
import NYX_DESIGN from "../../../samples/nyx-DESIGN.md?raw";

function extractThemeBlock(css: string, theme: "dark" | "light"): Map<string, string> {
  const vars = new Map<string, string>();
  const selector = `[data-theme="${theme}"] .nyx-showcase,[data-theme="${theme}"] .design-mode-scroll`;
  const start = css.indexOf(selector);
  if (start === -1) return vars;
  const braceStart = css.indexOf("{", start);
  const braceEnd = css.indexOf("}", braceStart);
  if (braceStart === -1 || braceEnd === -1) return vars;
  const inner = css.slice(braceStart + 1, braceEnd);
  for (const decl of inner.split(";")) {
    const colonIdx = decl.indexOf(":");
    if (colonIdx === -1) continue;
    const key = decl.slice(0, colonIdx).trim();
    const val = decl.slice(colonIdx + 1).trim();
    if (key && val) vars.set(key, val);
  }
  return vars;
}

function isColorDarkValue(value: string): boolean | null {
  const c = parseColor(value);
  if (!c) return null;
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) < 128;
}

function isLightColor(value: string): boolean | null {
  const dark = isColorDarkValue(value);
  return dark === null ? null : !dark;
}

describe("showcaseTheme generalization — synthetic fixtures", () => {
  describe("mixed light/dark surfaces", () => {
    it("generates non-null showcase CSS", () => {
      const doc = runDesignPipeline(MIXED_SURFACES);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css!.length).toBeGreaterThan(100);
    });

    it("light theme bg is light, not dark tile surface", () => {
      const doc = runDesignPipeline(MIXED_SURFACES);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const bg = lightVars.get("--nyx-bg");
      expect(bg).toBeDefined();
      if (bg) {
        const dark = isColorDarkValue(bg);
        if (dark !== null) expect(dark).toBe(false);
      }
    });

    it("dark tile surface does not become light global surface", () => {
      const doc = runDesignPipeline(MIXED_SURFACES);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const surface = lightVars.get("--nyx-surface");
      expect(surface).toBeDefined();
      if (surface) {
        const dark = isColorDarkValue(surface);
        if (dark !== null) expect(dark).toBe(false);
      }
    });

    it("dark theme bg is dark", () => {
      const doc = runDesignPipeline(MIXED_SURFACES);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const bg = darkVars.get("--nyx-bg");
      expect(bg).toBeDefined();
      if (bg) {
        const dark = isColorDarkValue(bg);
        if (dark !== null) expect(dark).toBe(true);
      }
    });

    it("accent is mapped from primary token", () => {
      const doc = runDesignPipeline(MIXED_SURFACES);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const accent = lightVars.get("--nyx-accent");
      expect(accent).toBeDefined();
      expect(accent?.toLowerCase()).toBe("#0066cc");
    });
  });

  describe("dark-only design", () => {
    it("generates non-null showcase CSS", () => {
      const doc = runDesignPipeline(DARK_ONLY);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css!.length).toBeGreaterThan(100);
    });

    it("dark theme bg is black or near-black", () => {
      const doc = runDesignPipeline(DARK_ONLY);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const bg = darkVars.get("--nyx-bg");
      expect(bg).toBeDefined();
      if (bg) {
        const dark = isColorDarkValue(bg);
        expect(dark).toBe(true);
      }
    });

    it("dark theme surface is near-black (#1d1d1f)", () => {
      const doc = runDesignPipeline(DARK_ONLY);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const surface = darkVars.get("--nyx-surface");
      expect(surface).toBeDefined();
      expect(surface?.toLowerCase()).toBe("#1d1d1f");
    });

    it("accent is sky blue (#38bdf8)", () => {
      const doc = runDesignPipeline(DARK_ONLY);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const accent = darkVars.get("--nyx-accent");
      expect(accent).toBeDefined();
      expect(accent?.toLowerCase()).toBe("#38bdf8");
    });

    it("accent-bg is a tint, never becomes page bg", () => {
      const doc = runDesignPipeline(DARK_ONLY);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const accentBg = darkVars.get("--nyx-accent-bg");
      const bg = darkVars.get("--nyx-bg");
      expect(accentBg).toBeDefined();
      expect(bg).toBeDefined();
      expect(accentBg).not.toBe(bg);
      expect(accentBg).toContain("rgba");
    });

    it("light theme does not use accent-bg as page background", () => {
      const doc = runDesignPipeline(DARK_ONLY);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const bg = lightVars.get("--nyx-bg");
      const accentBg = lightVars.get("--nyx-accent-bg");
      if (bg && accentBg) {
        expect(bg).not.toBe(accentBg);
      }
    });
  });

  describe("sharp editorial design — all 0px radii", () => {
    it("generates non-null showcase CSS", () => {
      const doc = runDesignPipeline(SHARP_EDITORIAL);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css!.length).toBeGreaterThan(100);
    });

    it("button radius is 0px", () => {
      const doc = runDesignPipeline(SHARP_EDITORIAL);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-radius-btn:0px");
    });

    it("card radius is 0px", () => {
      const doc = runDesignPipeline(SHARP_EDITORIAL);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-radius-card:0px");
    });

    it("input radius is 0px", () => {
      const doc = runDesignPipeline(SHARP_EDITORIAL);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-radius-input:0px");
    });

    it("all interactive radii collapse to 0px from component recipes", () => {
      const doc = runDesignPipeline(SHARP_EDITORIAL);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-radius-btn:0px");
      expect(css).toContain("--nyx-radius-card:0px");
      expect(css).toContain("--nyx-radius-input:0px");
      expect(css).toContain("--nyx-radius-badge:0px");
    });
  });

  describe("frosted card design", () => {
    it("generates non-null showcase CSS", () => {
      const doc = runDesignPipeline(FROSTED_CARDS);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css!.length).toBeGreaterThan(100);
    });

    it("light theme bg is light page color, not dark surface", () => {
      const doc = runDesignPipeline(FROSTED_CARDS);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const bg = lightVars.get("--nyx-bg");
      expect(bg).toBeDefined();
      if (bg) {
        const dark = isColorDarkValue(bg);
        if (dark !== null) expect(dark).toBe(false);
      }
    });

    it("light frosted surface does not become dark global surface", () => {
      const doc = runDesignPipeline(FROSTED_CARDS);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const surface = lightVars.get("--nyx-surface");
      expect(surface).toBeDefined();
      if (surface) {
        const dark = isColorDarkValue(surface);
        if (dark !== null) expect(dark).toBe(false);
      }
    });

    it("dark theme surface is dark", () => {
      const doc = runDesignPipeline(FROSTED_CARDS);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const surface = darkVars.get("--nyx-surface");
      expect(surface).toBeDefined();
      if (surface) {
        const dark = isColorDarkValue(surface);
        if (dark !== null) expect(dark).toBe(true);
      }
    });

    it("accent is mapped from primary token", () => {
      const doc = runDesignPipeline(FROSTED_CARDS);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const accent = lightVars.get("--nyx-accent");
      expect(accent).toBeDefined();
      expect(accent?.toLowerCase()).toBe("#6366f1");
    });
  });
});

describe("nyx regression coverage", () => {
  it("nyx DESIGN.md generates non-null showcase CSS", () => {
    const doc = runDesignPipeline(NYX_DESIGN);
    const css = buildShowcaseCSS(doc);
    expect(css).not.toBeNull();
    expect(css!.length).toBeGreaterThan(100);
  });

  it("nyx dark theme bg is black (#000000)", () => {
    const doc = runDesignPipeline(NYX_DESIGN);
    const css = buildShowcaseCSS(doc);
    expect(css).not.toBeNull();
    const darkVars = extractThemeBlock(css!, "dark");
    const bg = darkVars.get("--nyx-bg");
    expect(bg).toBeDefined();
    expect(bg?.toLowerCase()).toBe("#000000");
  });

  it("nyx dark theme surface is #1d1d1f", () => {
    const doc = runDesignPipeline(NYX_DESIGN);
    const css = buildShowcaseCSS(doc);
    expect(css).not.toBeNull();
    const darkVars = extractThemeBlock(css!, "dark");
    const surface = darkVars.get("--nyx-surface");
    expect(surface).toBeDefined();
    expect(surface?.toLowerCase()).toBe("#1d1d1f");
  });

  it("nyx dark theme accent is sky blue (#38bdf8)", () => {
    const doc = runDesignPipeline(NYX_DESIGN);
    const css = buildShowcaseCSS(doc);
    expect(css).not.toBeNull();
    const darkVars = extractThemeBlock(css!, "dark");
    const accent = darkVars.get("--nyx-accent");
    expect(accent).toBeDefined();
    expect(accent?.toLowerCase()).toBe("#38bdf8");
  });

  it("nyx dark theme text-heading is white (#ffffff)", () => {
    const doc = runDesignPipeline(NYX_DESIGN);
    const css = buildShowcaseCSS(doc);
    expect(css).not.toBeNull();
    const darkVars = extractThemeBlock(css!, "dark");
    const textHead = darkVars.get("--nyx-text-head");
    expect(textHead).toBeDefined();
    expect(textHead?.toLowerCase()).toBe("#ffffff");
  });

  it("nyx dark theme text-body is rgba white", () => {
    const doc = runDesignPipeline(NYX_DESIGN);
    const css = buildShowcaseCSS(doc);
    expect(css).not.toBeNull();
    const darkVars = extractThemeBlock(css!, "dark");
    const textBody = darkVars.get("--nyx-text-body");
    expect(textBody).toBeDefined();
    expect(textBody?.toLowerCase()).toBe("rgba(255,255,255,0.85)");
  });

  it("nyx light export does not use accent-bg as page background", () => {
    const doc = runDesignPipeline(NYX_DESIGN);
    const css = buildShowcaseCSS(doc);
    expect(css).not.toBeNull();
    const lightVars = extractThemeBlock(css!, "light");
    const bg = lightVars.get("--nyx-bg");
    const accentBg = lightVars.get("--nyx-accent-bg");
    expect(bg).toBeDefined();
    expect(accentBg).toBeDefined();
    expect(bg).not.toBe(accentBg);
    const bgDark = isColorDarkValue(bg!);
    if (bgDark !== null) expect(bgDark).toBe(false);
  });

  it("nyx light export synthesizes opaque light page and surface colors", () => {
    const doc = runDesignPipeline(NYX_DESIGN);
    const css = buildShowcaseCSS(doc);
    expect(css).not.toBeNull();
    const lightVars = extractThemeBlock(css!, "light");
    expect(lightVars.get("--nyx-bg")).toBe("#f5f5f7");
    expect(lightVars.get("--nyx-surface")).toBe("#ffffff");
  });

  it("nyx light theme surface is light", () => {
    const doc = runDesignPipeline(NYX_DESIGN);
    const css = buildShowcaseCSS(doc);
    expect(css).not.toBeNull();
    const lightVars = extractThemeBlock(css!, "light");
    const surface = lightVars.get("--nyx-surface");
    expect(surface).toBeDefined();
    if (surface) {
      const light = isLightColor(surface);
      if (light !== null) expect(light).toBe(true);
    }
  });

  it("nyx dark theme has critical --nyx-* variables", () => {
    const doc = runDesignPipeline(NYX_DESIGN);
    const css = buildShowcaseCSS(doc);
    expect(css).not.toBeNull();
    const darkVars = extractThemeBlock(css!, "dark");
    const criticalVars = [
      "--nyx-bg",
      "--nyx-surface",
      "--nyx-accent",
      "--nyx-text-head",
      "--nyx-text-body",
      "--nyx-text-muted",
    ];
    for (const v of criticalVars) {
      expect(darkVars.has(v), `${v} should be present in dark theme`).toBe(true);
    }
  });
});
