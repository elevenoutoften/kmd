import { describe, expect, it } from "vitest";
import {
  buildShowcaseCSS,
  isOnVariant,
  normalizeTokenName,
  safeCssValue,
  scoreToken,
  pickBest,
  parseColor,
  isColorDark,
  detectIsDarkTheme,
  invertColor,
  mapRecipeStyles,
  resolveRecipeValue,
  inferRecipeFamily,
  isGenericCardRecipe,
  pickRecipeProp,
  mapRadiusToken,
  isTextLikeToken,
  isPaletteAccentToken,
} from "./showcaseTheme";
import type { ColorToken, ComponentRecipe, DesignDocument } from "@/parser/design";
import { runDesignPipelineCached } from "@/parser/design";
import APPLE from "../../../fixtures/apple-DESIGN.md?raw";
import DYLAN from "../../../fixtures/dylanbrouwer-DESIGN.md?raw";
import SHOPVIBE from "../../../fixtures/shopvibe-DESIGN.md?raw";

function makeColorToken(
  name: string,
  value: string,
  overrides?: Partial<ColorToken>,
): ColorToken {
  return {
    name,
    value,
    provenance: { extractor: "test" },
    ...overrides,
  };
}

function makeDoc(colorTokens: ColorToken[]): DesignDocument {
  return {
    meta: { name: "Test", description: "", sourceLength: 0 },
    detection: { score: 1, signals: [] },
    diagnostics: [],
    _sourceContent: "",
    spec: {
      colors: {},
      typography: {},
      spacing: {},
      radii: {},
      layout: {},
      raw: {},
      colorTokens,
    },
  };
}

describe("showcaseTheme", () => {
  describe("isOnVariant", () => {
    it("excludes on-primary tokens", () => {
      expect(isOnVariant("on-primary")).toBe(true);
    });

    it("excludes on-accent tokens", () => {
      expect(isOnVariant("on-accent")).toBe(true);
    });

    it("excludes on-dark suffix tokens", () => {
      expect(isOnVariant("primary-on-dark")).toBe(true);
    });

    it("excludes text-on- prefix tokens", () => {
      expect(isOnVariant("text-on-primary")).toBe(true);
    });

    it("allows plain primary token", () => {
      expect(isOnVariant("primary")).toBe(false);
    });

    it("allows accent token", () => {
      expect(isOnVariant("accent")).toBe(false);
    });

    it("allows brand token", () => {
      expect(isOnVariant("brand")).toBe(false);
    });
  });

  describe("normalizeTokenName", () => {
    it("lowercases and normalizes separators", () => {
      expect(normalizeTokenName("Primary-ON-Dark")).toBe("primary on dark");
      expect(normalizeTokenName("Text_Body")).toBe("text body");
    });
  });

  describe("safeCssValue", () => {
    it("blocks url() values", () => {
      expect(safeCssValue("url(https://evil.com)")).toBeUndefined();
    });

    it("blocks javascript: scheme values", () => {
      expect(safeCssValue("javascript:alert(1)")).toBeUndefined();
    });

    it("blocks vbscript: scheme values", () => {
      expect(safeCssValue("vbscript:run()")).toBeUndefined();
    });

    it("blocks declaration-breaking characters", () => {
      expect(safeCssValue("red;}body{color:red")).toBeUndefined();
    });

    it("allows safe hex colors", () => {
      expect(safeCssValue("#B84E3E")).toBe("#B84E3E");
    });

    it("allows safe rgba values", () => {
      expect(safeCssValue("rgba(255,255,255,0.1)")).toBe("rgba(255,255,255,0.1)");
    });

    it("blocks expression() values", () => {
      expect(safeCssValue("expression(alert(1))")).toBeUndefined();
    });

    it("allows safe font family stacks with quotes", () => {
      expect(safeCssValue('"Inter", sans-serif')).toBe('"Inter", sans-serif');
    });

    it("allows generic font family keywords", () => {
      expect(safeCssValue("monospace")).toBe("monospace");
    });
  });

  describe("scoreToken", () => {
    const accentKeywords = [
      { pattern: /^(?:primary|accent|brand|action|link)$/, confidence: 100 },
      { pattern: /\b(?:primary|accent|brand|action|link)\b/, confidence: 80 },
    ];

    it("scores exact primary match highest", () => {
      const token = makeColorToken("Primary", "#007AFF");
      expect(scoreToken(token, accentKeywords, true)).toBe(100);
    });

    it("excludes on-primary when excludeOnVariants is true", () => {
      const token = makeColorToken("On-Primary", "#FFFFFF");
      expect(scoreToken(token, accentKeywords, true)).toBe(0);
    });

    it("scores partial keyword match lower", () => {
      const token = makeColorToken("Primary Hover", "#0066CC");
      expect(scoreToken(token, accentKeywords, true)).toBe(80);
    });

    it("returns 0 for unrelated token names", () => {
      const token = makeColorToken("Background", "#FFFFFF");
      expect(scoreToken(token, accentKeywords, true)).toBe(0);
    });

    it("uses token role as secondary signal", () => {
      const token = makeColorToken("my-brand-color", "#007AFF", { role: "accent" });
      const score = scoreToken(token, accentKeywords, true);
      expect(score).toBeGreaterThanOrEqual(50);
    });
  });

  describe("pickBest", () => {
    it("prefers higher confidence over earlier position", () => {
      const keywords = [
        { pattern: /^(?:primary|accent|brand|action|link)$/, confidence: 100 },
        { pattern: /\b(?:primary|accent|brand|action|link)\b/, confidence: 80 },
      ];
      const tokens = [
        makeColorToken("On-Primary", "#FFFFFF"),
        makeColorToken("Primary", "#007AFF"),
        makeColorToken("Primary-Hover", "#0066CC"),
      ];
      const best = pickBest(tokens, keywords, true);
      expect(best?.name).toBe("Primary");
    });

    it("does not select on-variant tokens for accent", () => {
      const keywords = [
        { pattern: /^(?:primary|accent|brand|action|link)$/, confidence: 100 },
        { pattern: /\b(?:primary|accent|brand|action|link)\b/, confidence: 80 },
      ];
      const tokens = [
        makeColorToken("On-Primary", "#FFFFFF"),
        makeColorToken("On-Accent", "#000000"),
      ];
      const best = pickBest(tokens, keywords, true);
      expect(best).toBeUndefined();
    });
  });

  describe("buildShowcaseCSS", () => {
    it("maps Apple-like primary to --nyx-accent, not on-primary", () => {
      const tokens = [
        makeColorToken("Primary", "#007AFF"),
        makeColorToken("On-Primary", "#FFFFFF"),
        makeColorToken("Background", "#F5F5F7"),
        makeColorToken("Surface", "#FFFFFF"),
        makeColorToken("Text Primary", "#1D1D1F"),
        makeColorToken("Border Subtle", "#D2D2D7"),
      ];
      const css = buildShowcaseCSS(makeDoc(tokens));
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-accent:#007AFF");
      expect(css).not.toContain("--nyx-accent:#FFFFFF");
      expect(css).toContain("--nyx-bg:#F5F5F7");
      expect(css).toContain("--nyx-surface:#FFFFFF");
      expect(css).toContain("--nyx-text-head:#1D1D1F");
      expect(css).toContain("--nyx-sep:#D2D2D7");
    });

    it("maps ThoughtStream-like Background, Surface, Text Primary, Border Subtle", () => {
      const tokens = [
        makeColorToken("Background", "#FAFAFA"),
        makeColorToken("Surface", "#FFFFFF"),
        makeColorToken("Text Primary", "#1A1A1A"),
        makeColorToken("Text Muted", "#6B6B6B"),
        makeColorToken("Border Subtle", "#E5E5E5"),
        makeColorToken("Accent", "#5B5FC7"),
      ];
      const css = buildShowcaseCSS(makeDoc(tokens));
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-bg:#FAFAFA");
      expect(css).toContain("--nyx-surface:#FFFFFF");
      expect(css).toContain("--nyx-text-head:#1A1A1A");
      expect(css).toContain("--nyx-text-muted:#6B6B6B");
      expect(css).toContain("--nyx-sep:#E5E5E5");
      expect(css).toContain("--nyx-accent:#5B5FC7");
    });

    it("maps ShopVibe-like semantic background tokens when present", () => {
      const tokens = [
        makeColorToken("Background", "#FFFFFF"),
        makeColorToken("Surface", "#F8F8F8"),
        makeColorToken("Primary", "#6C5CE7"),
        makeColorToken("Positive", "#00B894"),
        makeColorToken("Positive Background", "#E8F8F5"),
        makeColorToken("Warning", "#FDCB6E"),
        makeColorToken("Warning Background", "#FFF9E6"),
        makeColorToken("Error", "#E17055"),
      ];
      const css = buildShowcaseCSS(makeDoc(tokens));
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-accent:#6C5CE7");
      expect(css).toContain("--nyx-positive:#00B894");
      expect(css).toContain("--nyx-positive-bg:#E8F8F5");
      expect(css).toContain("--nyx-warning:#FDCB6E");
      expect(css).toContain("--nyx-warning-bg:#FFF9E6");
      expect(css).toContain("--nyx-error:#E17055");
    });

    it("returns identical CSS for the same document called twice", () => {
      const tokens = [
        makeColorToken("Primary", "#007AFF"),
        makeColorToken("Background", "#F5F5F7"),
        makeColorToken("Surface", "#FFFFFF"),
        makeColorToken("Text Primary", "#1D1D1F"),
      ];
      const doc = makeDoc(tokens);
      const css1 = buildShowcaseCSS(doc);
      const css2 = buildShowcaseCSS(doc);
      expect(css1).toBe(css2);
    });

    it("produces deterministic CSS across fixture documents", () => {
      for (const content of [APPLE, DYLAN, SHOPVIBE]) {
        const doc = runDesignPipelineCached(content);
        const css1 = buildShowcaseCSS(doc);
        const css2 = buildShowcaseCSS(doc);
        expect(css1).toBe(css2);
      }
    });

    it("returns null for documents with no color or typography tokens", () => {
      const doc: DesignDocument = {
        meta: { name: "Empty", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
        },
      };
      expect(buildShowcaseCSS(doc)).toBeNull();
    });

    it("includes light and dark theme declarations", () => {
      const tokens = [
        makeColorToken("Background", "#FFFFFF"),
        makeColorToken("Text Primary", "#1D1D1F"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const css = buildShowcaseCSS(makeDoc(tokens));
      expect(css).toContain('[data-theme="dark"]');
      expect(css).toContain('[data-theme="light"]');
    });

    it("does not include url() in any CSS output", () => {
      const unsafeToken: ColorToken = {
        name: "Primary",
        value: "url(https://evil.com/style.css)",
        provenance: { extractor: "test" },
      };
      const doc = makeDoc([unsafeToken]);
      const css = buildShowcaseCSS(doc);
      if (css !== null) {
        expect(css).not.toContain("url(");
      }
    });

    it("does not include javascript: in any CSS output", () => {
      const unsafeToken: ColorToken = {
        name: "Primary",
        value: "javascript:alert(1)",
        provenance: { extractor: "test" },
      };
      const doc = makeDoc([unsafeToken]);
      const css = buildShowcaseCSS(doc);
      if (css !== null) {
        expect(css).not.toContain("javascript:");
      }
    });

    it("prefers exact token names over broad role guesses", () => {
      const tokens = [
        makeColorToken("text on primary", "#FFFFFF"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const css = buildShowcaseCSS(makeDoc(tokens));
      expect(css).toContain("--nyx-accent:#007AFF");
      expect(css).not.toContain("--nyx-accent:#FFFFFF");
    });

    it("maps info tokens when present", () => {
      const tokens = [
        makeColorToken("Info", "#2563EB"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const css = buildShowcaseCSS(makeDoc(tokens));
      expect(css).toContain("--nyx-info:#2563EB");
    });

    it("maps accent-hover tokens", () => {
      const tokens = [
        makeColorToken("Primary", "#007AFF"),
        makeColorToken("Primary Hover", "#0066CC"),
      ];
      const css = buildShowcaseCSS(makeDoc(tokens));
      expect(css).toContain("--nyx-accent:#007AFF");
      expect(css).toContain("--nyx-accent-hover:#0066CC");
    });
  });

  describe("parseColor", () => {
    it("parses 6-digit hex", () => {
      const result = parseColor("#007AFF");
      expect(result).toEqual({ r: 0, g: 122, b: 255, a: 1 });
    });

    it("parses 3-digit hex", () => {
      const result = parseColor("#ABC");
      expect(result).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    });

    it("parses rgba", () => {
      const result = parseColor("rgba(255,0,0,0.5)");
      expect(result).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    });

    it("returns null for invalid colors", () => {
      expect(parseColor("not-a-color")).toBeNull();
    });
  });

  describe("isColorDark", () => {
    it("identifies dark colors", () => {
      expect(isColorDark("#1D1D1F")).toBe(true);
    });

    it("identifies light colors", () => {
      expect(isColorDark("#FFFFFF")).toBe(false);
    });

    it("returns null for unparseable colors", () => {
      expect(isColorDark("invalid")).toBeNull();
    });
  });

  describe("invertColor", () => {
    it("inverts a hex color", () => {
      expect(invertColor("#000000")).toBe("#ffffff");
      expect(invertColor("#FFFFFF")).toBe("#000000");
    });

    it("inverts an rgba color preserving alpha", () => {
      expect(invertColor("rgba(0,0,0,0.5)")).toBe("rgba(255,255,255,0.5)");
    });

    it("passes through unparseable values", () => {
      expect(invertColor("invalid")).toBe("invalid");
    });
  });

  describe("detectIsDarkTheme", () => {
    it("detects light theme from bg", () => {
      const vars = new Map<string, string>();
      vars.set("--nyx-bg", "#FFFFFF");
      expect(detectIsDarkTheme(vars)).toBe(false);
    });

    it("detects dark theme from bg", () => {
      const vars = new Map<string, string>();
      vars.set("--nyx-bg", "#1D1D1F");
      expect(detectIsDarkTheme(vars)).toBe(true);
    });

    it("defaults to dark when no info available", () => {
      const vars = new Map<string, string>();
      expect(detectIsDarkTheme(vars)).toBe(true);
    });
  });

  describe("inferRecipeFamily", () => {
    it("infers button from name containing 'button'", () => {
      expect(inferRecipeFamily("button-primary", {})).toBe("button");
    });

    it("infers button from name containing 'btn'", () => {
      expect(inferRecipeFamily("btn", {})).toBe("button");
    });

    it("infers card from name containing 'card'", () => {
      expect(inferRecipeFamily("reader-card", {})).toBe("card");
    });

    it("infers input from name containing 'input'", () => {
      expect(inferRecipeFamily("text-input", {})).toBe("input");
    });

    it("infers input from 'search-input' name", () => {
      expect(inferRecipeFamily("search-input", {})).toBe("input");
    });

    it("infers badge from name containing 'badge'", () => {
      expect(inferRecipeFamily("status-badge", {})).toBe("badge");
    });

    it("infers chip from name containing 'chip'", () => {
      expect(inferRecipeFamily("action-chip", {})).toBe("chip");
    });

    it("infers tag from name containing 'tag'", () => {
      expect(inferRecipeFamily("filter-tag", {})).toBe("tag");
    });

    it("returns undefined for unknown names", () => {
      expect(inferRecipeFamily("hero-section", {})).toBeUndefined();
    });

    it("uses family property when name is ambiguous", () => {
      expect(inferRecipeFamily("cta", { family: "button" })).toBe("button");
    });
  });

  describe("pickRecipeProp", () => {
    it("picks the first available property", () => {
      expect(pickRecipeProp({ borderRadius: "8px" }, ["borderRadius", "border-radius", "radius"])).toBe("8px");
    });

    it("falls back to alternate keys", () => {
      expect(pickRecipeProp({ "border-radius": "8px" }, ["borderRadius", "border-radius", "radius"])).toBe("8px");
    });

    it("returns undefined when no key matches", () => {
      expect(pickRecipeProp({ background: "#fff" }, ["borderRadius", "radius"])).toBeUndefined();
    });

    it("skips empty string values", () => {
      expect(pickRecipeProp({ borderRadius: "", radius: "12px" }, ["borderRadius", "radius"])).toBe("12px");
    });
  });

  describe("resolveRecipeValue", () => {
    const doc: DesignDocument = {
      meta: { name: "Test", description: "", sourceLength: 0 },
      detection: { score: 1, signals: [] },
      diagnostics: [],
      _sourceContent: "",
      spec: {
        colors: {},
        typography: {},
        spacing: {},
        radii: { pill: "9999px", md: "8px" },
        layout: {},
        raw: {},
      },
    };

    it("resolves {rounded.pill} to the radius value", () => {
      expect(resolveRecipeValue("{rounded.pill}", doc)).toBe("9999px");
    });

    it("resolves {rounded.md} through the alias", () => {
      expect(resolveRecipeValue("{rounded.md}", doc)).toBe("8px");
    });

    it("leaves unresolved references as-is", () => {
      expect(resolveRecipeValue("{unknown.token}", doc)).toBe("{unknown.token}");
    });

    it("returns plain values unchanged", () => {
      expect(resolveRecipeValue("#FFFFFF", doc)).toBe("#FFFFFF");
    });

    it("resolves {radius.md} with radius alias", () => {
      expect(resolveRecipeValue("{radius.md}", doc)).toBe("8px");
    });
  });

  describe("mapRecipeStyles", () => {
    function makeDocWith(
      colorTokens: ColorToken[] = [],
      componentRecipes: ComponentRecipe[] = [],
      overrides?: Partial<DesignDocument["spec"]>,
    ): DesignDocument {
      return {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens,
          componentRecipes,
          ...overrides,
        },
      };
    }

    it("maps button radius to --nyx-radius-btn", () => {
      const doc = makeDocWith([], [
        { name: "button-primary", properties: { borderRadius: "8px", backgroundColor: "#007AFF", textColor: "#FFFFFF" }, provenance: { extractor: "yaml" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-btn:8px");
    });

    it("maps button textColor to --nyx-btn-primary-text", () => {
      const doc = makeDocWith([], [
        { name: "button-primary", properties: { textColor: "#FFFFFF", backgroundColor: "#007AFF" }, provenance: { extractor: "yaml" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-btn-primary-text:#FFFFFF");
    });

    it("maps button hover to --nyx-accent-hover", () => {
      const doc = makeDocWith([], [
        { name: "button-primary", properties: { "hover-background": "#0066CC", backgroundColor: "#007AFF" }, provenance: { extractor: "yaml" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-accent-hover:#0066CC");
    });

    it("maps card properties", () => {
      const doc = makeDocWith([], [
        { name: "reader-card", properties: { borderRadius: "16px", padding: "24px", borderColor: "#E0E0E0", backgroundColor: "#FFFFFF" }, provenance: { extractor: "yaml" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-card:16px");
      expect(css).toContain("--nyx-card-padding:24px");
      expect(css).toContain("--nyx-card-highlight-border:#E0E0E0");
      expect(css).toContain("--nyx-surface:#FFFFFF");
    });

    it("maps badge radius to --nyx-radius-badge", () => {
      const doc = makeDocWith([], [
        { name: "status-badge", properties: { borderRadius: "9999px", backgroundColor: "#E8F8F5" }, provenance: { extractor: "yaml" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-badge:9999px");
    });

    it("maps chip radius to both --nyx-radius-badge and --nyx-radius-tag", () => {
      const doc = makeDocWith([], [
        { name: "action-chip", properties: { borderRadius: "9999px" }, provenance: { extractor: "yaml" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-badge:9999px");
      expect(css).toContain("--nyx-radius-tag:9999px");
    });

    it("maps tag radius to --nyx-radius-tag", () => {
      const doc = makeDocWith([], [
        { name: "filter-tag", properties: { borderRadius: "6px" }, provenance: { extractor: "yaml" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-tag:6px");
    });

    it("maps input properties", () => {
      const doc = makeDocWith([], [
        { name: "Text Input", properties: { background: "#F8F8F8", border: "#D1D5DB", borderRadius: "8px", height: "40px", padding: "8px 12px", "focus-ring": "#007AFF" }, provenance: { extractor: "prose" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-input-bg:#F8F8F8");
      expect(css).toContain("--nyx-input-border:#D1D5DB");
      expect(css).toContain("--nyx-radius-input:8px");
      expect(css).toContain("--nyx-input-height:40px");
      expect(css).toContain("--nyx-input-padding:8px 12px");
      expect(css).toContain("--nyx-input-focus-ring:#007AFF");
    });

    it("maps input label, helper, placeholder from explicit properties", () => {
      const doc = makeDocWith([], [
        { name: "Text Input", properties: { family: "input", background: "#F8F8F8", border: "#D1D5DB", labelColor: "#374151", helperColor: "#6B7280", placeholderColor: "#9CA3AF" }, provenance: { extractor: "prose" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-input-label:#374151");
      expect(css).toContain("--nyx-input-helper:#6B7280");
      expect(css).toContain("--nyx-input-placeholder:#9CA3AF");
    });

    it("derives input label from textColor when labelColor is absent", () => {
      const doc = makeDocWith([], [
        { name: "Text Input", properties: { family: "input", background: "#F8F8F8", border: "#D1D5DB", textColor: "#1F2937" }, provenance: { extractor: "prose" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-input-label:#1F2937");
    });

    it("derives input helper from textColor when helperColor is absent", () => {
      const doc = makeDocWith([], [
        { name: "Text Input", properties: { family: "input", background: "#F8F8F8", border: "#D1D5DB", textColor: "#1F2937" }, provenance: { extractor: "prose" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-input-helper:#1F2937");
    });

    it("explicit labelColor overrides textColor for input label", () => {
      const doc = makeDocWith([], [
        { name: "Text Input", properties: { family: "input", background: "#F8F8F8", border: "#D1D5DB", textColor: "#1F2937", labelColor: "#374151" }, provenance: { extractor: "prose" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-input-label:#374151");
    });

    it("dark mode input labels use neutral text values, not pure white", () => {
      const tokens = [
        makeColorToken("Background", "#111827"),
        makeColorToken("Surface", "#1F2937"),
        makeColorToken("Text Primary", "#F9FAFB"),
        makeColorToken("Text Muted", "#9CA3AF"),
        makeColorToken("Primary", "#6366F1"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css).not.toContain("--nyx-input-label:#FFFFFF");
      expect(css).not.toContain("--nyx-input-label:#ffffff");
      expect(css).toContain("--nyx-input-label:");
    });

    it("ThoughtStream input uses strict rectangular geometry and warm neutral colors", () => {
      const doc = makeDocWith([], [
        { name: "Text Input", properties: { family: "input", radius: "0px", background: "#FAFAF9", border: "#E7E5E4", textColor: "#44403C", labelColor: "#57534E", helperColor: "#78716C", placeholderColor: "#A8A29E" }, provenance: { extractor: "component" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-input:0px");
      expect(css).toContain("--nyx-input-bg:#FAFAF9");
      expect(css).toContain("--nyx-input-border:#E7E5E4");
      expect(css).toContain("--nyx-input-label:#57534E");
      expect(css).toContain("--nyx-input-helper:#78716C");
      expect(css).toContain("--nyx-input-placeholder:#A8A29E");
    });

    it("does not emit unsafe input text values", () => {
      const doc = makeDocWith([], [
        { name: "Text Input", properties: { family: "input", background: "#F8F8F8", border: "#D1D5DB", labelColor: "url(https://evil.com)", helperColor: "javascript:alert(1)", placeholderColor: "expression(alert(1))" }, provenance: { extractor: "test" } },
      ]);
      const css = buildShowcaseCSS(doc);
      if (css !== null) {
        expect(css).not.toContain("--nyx-input-label:url(");
        expect(css).not.toContain("--nyx-input-helper:javascript:");
        expect(css).not.toContain("--nyx-input-placeholder:expression(");
      }
    });

    it("resolves token references in component recipes", () => {
      const doc = makeDocWith([], [
        { name: "search-input", properties: { rounded: "{rounded.pill}", background: "{colors.canvas}" }, provenance: { extractor: "yaml" } },
      ], { radii: { pill: "9999px" }, colors: { canvas: "#F5F5F7" } });
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-input:9999px");
      expect(css).toContain("--nyx-input-bg:#F5F5F7");
    });

    it("does not emit unsafe CSS values from component recipes", () => {
      const doc = makeDocWith([], [
        { name: "button-primary", properties: { backgroundColor: "url(https://evil.com)", textColor: "javascript:alert(1)", borderRadius: "red;}body{color:red" }, provenance: { extractor: "test" } },
      ]);
      const css = buildShowcaseCSS(doc);
      if (css !== null) {
        expect(css).not.toContain("--nyx-btn-primary-text:javascript:");
        expect(css).not.toContain("url(");
        expect(css).not.toContain(";}body{");
      }
    });

    it("does not emit unsafe component border values", () => {
      const doc = makeDocWith([], [
        { name: "card-danger", properties: { borderColor: "expression(alert(1))" }, provenance: { extractor: "test" } },
      ]);
      const css = buildShowcaseCSS(doc);
      if (css !== null) {
        expect(css).not.toContain("expression(");
      }
    });

    it("prefers component-specific values over broad token defaults", () => {
      const doc = makeDocWith([], [
        { name: "button-primary", properties: { borderRadius: "24px", textColor: "#FFFFFF" }, provenance: { extractor: "yaml" } },
      ], { radii: { md: "8px" } });
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-btn:24px");
    });

    it("handles rounded alias for border-radius in button", () => {
      const doc = makeDocWith([], [
        { name: "primary-btn", properties: { rounded: "12px" }, provenance: { extractor: "yaml" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-btn:12px");
    });

    it("handles family property for ambiguous component names", () => {
      const doc = makeDocWith([], [
        { name: "cta", properties: { family: "button", borderRadius: "10px", textColor: "#000" }, provenance: { extractor: "prose" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-btn:10px");
      expect(css).toContain("--nyx-btn-primary-text:#000");
    });

    it("maps sharp 0px button radius from component recipe", () => {
      const doc = makeDocWith([], [
        { name: "Primary", properties: { family: "button", radius: "0px", background: "#57534E" }, provenance: { extractor: "component" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-btn:0px");
    });

    it("maps sharp 0px card radius from component recipe", () => {
      const doc = makeDocWith([], [
        { name: "Default", properties: { family: "card", radius: "0px", backgroundColor: "#FAFAF9" }, provenance: { extractor: "component" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-card:0px");
    });

    it("maps sharp 0px input radius from component recipe", () => {
      const doc = makeDocWith([], [
        { name: "Text Input", properties: { family: "input", radius: "0px", background: "#FAFAF9" }, provenance: { extractor: "component" } },
      ]);
      const css = buildShowcaseCSS(doc);
      expect(css).toContain("--nyx-radius-input:0px");
    });

    it("global zero radius token fills in missing component radii", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [],
          radiusTokens: [
            { name: "None", value: "0px", provenance: { extractor: "tables" } },
            { name: "Full", value: "9999px", provenance: { extractor: "tables" } },
          ],
          componentRecipes: [],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-radius-btn:0px");
      expect(css).toContain("--nyx-radius-card:0px");
      expect(css).toContain("--nyx-radius-input:0px");
    });

    it("component recipe radius beats global zero radius fallback", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [],
          radiusTokens: [
            { name: "None", value: "0px", provenance: { extractor: "tables" } },
          ],
          componentRecipes: [
            { name: "Default", properties: { family: "card", radius: "8px" }, provenance: { extractor: "component" } },
          ],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-radius-card:8px");
      expect(css).toContain("--nyx-radius-btn:0px");
      expect(css).toContain("--nyx-radius-input:0px");
    });

    it("generic radius token does not override component recipe radius", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [],
          radiusTokens: [
            { name: "Small", value: "4px", provenance: { extractor: "tables" } },
          ],
          componentRecipes: [
            { name: "Text Input", properties: { family: "input", radius: "0px" }, provenance: { extractor: "component" } },
          ],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-radius-input:0px");
    });
  });

  describe("dark/light theme separation — no blind inversion", () => {
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

    function isRedOrOrange(value: string): boolean {
      const m = value.match(/^#([0-9a-f]{6})$/i);
      if (!m) return false;
      const r = parseInt(m[1]!.slice(0, 2), 16);
      const g = parseInt(m[1]!.slice(2, 4), 16);
      const b = parseInt(m[1]!.slice(4, 6), 16);
      return r > 150 && g < 100 && b < 100;
    }

    function isColorDarkValue(value: string): boolean {
      const m = value.match(/^#([0-9a-f]{6})$/i);
      if (!m) return false;
      const r = parseInt(m[1]!.slice(0, 2), 16);
      const g = parseInt(m[1]!.slice(2, 4), 16);
      const b = parseInt(m[1]!.slice(4, 6), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
    }

    it("ShopVibe dark: text-muted and text-dim are not red/orange inverted from cyan", () => {
      const doc = runDesignPipelineCached(SHOPVIBE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const textMuted = darkVars.get("--nyx-text-muted");
      const textDim = darkVars.get("--nyx-text-dim");
      expect(textMuted).toBeDefined();
      expect(textDim).toBeDefined();
      if (textMuted) expect(isRedOrOrange(textMuted)).toBe(false);
      if (textDim) expect(isRedOrOrange(textDim)).toBe(false);
    });

    it("ShopVibe dark: accent-hover is fuchsia-derived, not default blue", () => {
      const doc = runDesignPipelineCached(SHOPVIBE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const accentHover = darkVars.get("--nyx-accent-hover");
      expect(accentHover).toBeDefined();
      expect(accentHover).not.toBe("#38bdf8");
    });

    it("Dylanbrouwer light: accent-hover is terracotta-derived, not default blue", () => {
      const doc = runDesignPipelineCached(DYLAN);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const accentHover = lightVars.get("--nyx-accent-hover");
      expect(accentHover).toBeDefined();
      expect(accentHover).not.toBe("#38bdf8");
    });

    it("Dylanbrouwer dark: accent-hover is terracotta-derived, not default blue", () => {
      const doc = runDesignPipelineCached(DYLAN);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const accentHover = darkVars.get("--nyx-accent-hover");
      expect(accentHover).toBeDefined();
      expect(accentHover).not.toBe("#38bdf8");
    });

    it("Apple dark: surface and bg are dark, not inverted light gray", () => {
      const doc = runDesignPipelineCached(APPLE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const surface = darkVars.get("--nyx-surface");
      expect(surface).toBeDefined();
      if (surface && surface.startsWith("#")) {
        expect(isColorDarkValue(surface)).toBe(true);
      }
    });

    it("Apple dark: accent is not inverted orange", () => {
      const doc = runDesignPipelineCached(APPLE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const accent = darkVars.get("--nyx-accent");
      expect(accent).toBeDefined();
      if (accent) expect(isRedOrOrange(accent)).toBe(false);
    });

    it("Apple dark: heading text comes from on-dark text, not primary-on-dark link blue", () => {
      const doc = runDesignPipelineCached(APPLE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      expect(darkVars.get("--nyx-text-head")).toBe("#ffffff");
      expect(darkVars.get("--nyx-text-head")).not.toBe(darkVars.get("--nyx-accent"));
    });

    it("Dylanbrouwer dark: cards and table surfaces are dark, not frosted white", () => {
      const doc = runDesignPipelineCached(DYLAN);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const surface = darkVars.get("--nyx-surface");
      const textHead = darkVars.get("--nyx-text-head");
      expect(surface).toBeDefined();
      expect(textHead).toBeDefined();
      if (surface?.startsWith("#")) expect(isColorDarkValue(surface)).toBe(true);
      if (textHead?.startsWith("#")) expect(isColorDarkValue(textHead)).toBe(false);
    });

    it("does not use palette tokens (Secondary cyan, Tertiary yellow) as dark body/muted/dim text", () => {
      const tokens = [
        makeColorToken("Primary", "#D946EF"),
        makeColorToken("Secondary", "#22D3EE"),
        makeColorToken("Tertiary", "#FACC15"),
        makeColorToken("Background", "#FAFAFA"),
        makeColorToken("Surface", "#FFFFFF"),
        makeColorToken("Text Primary", "#17191C"),
        makeColorToken("Text Secondary", "#6B7280"),
        makeColorToken("Text Tertiary", "#9CA3AF"),
        makeColorToken("Border", "#E5E7EB"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const textMuted = darkVars.get("--nyx-text-muted");
      const textDim = darkVars.get("--nyx-text-dim");
      if (textMuted) expect(isRedOrOrange(textMuted)).toBe(false);
      if (textDim) expect(isRedOrOrange(textDim)).toBe(false);
    });

    it("accent-hover is derived from accent when no explicit hover token exists", () => {
      const tokens = [
        makeColorToken("Primary", "#5B5FC7"),
        makeColorToken("Background", "#FAFAFA"),
        makeColorToken("Text Primary", "#1A1A1A"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const accentHover = lightVars.get("--nyx-accent-hover");
      const accent = lightVars.get("--nyx-accent");
      expect(accentHover).toBeDefined();
      expect(accentHover).not.toBe(accent);
      expect(accentHover).not.toBe("#38bdf8");
    });

    it("light theme bg is same as detected base, dark theme bg is conservative dark", () => {
      const tokens = [
        makeColorToken("Background", "#FFFFFF"),
        makeColorToken("Surface", "#F8F8F8"),
        makeColorToken("Text Primary", "#1A1A1A"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const darkVars = extractThemeBlock(css!, "dark");
      expect(lightVars.get("--nyx-bg")).toBe("#FFFFFF");
      expect(darkVars.get("--nyx-bg")).toBeDefined();
      const darkBg = darkVars.get("--nyx-bg")!;
      if (darkBg.startsWith("#")) {
        expect(isColorDarkValue(darkBg)).toBe(true);
      }
    });

    it("dark theme does not invert positive/warning/info semantic colors", () => {
      const tokens = [
        makeColorToken("Primary", "#007AFF"),
        makeColorToken("Background", "#FFFFFF"),
        makeColorToken("Positive", "#34C759"),
        makeColorToken("Warning", "#FF9500"),
        makeColorToken("Info", "#007AFF"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      expect(darkVars.get("--nyx-positive")).toBe("#34C759");
      expect(darkVars.get("--nyx-warning")).toBe("#FF9500");
    });

    it("explicit dark tokens are used for dark theme when present", () => {
      const tokens = [
        makeColorToken("Background", "#FFFFFF"),
        makeColorToken("Background Dark", "#1C1C1E"),
        makeColorToken("Text Primary", "#1C1C1E"),
        makeColorToken("Text on Dark", "#F5F5F7"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      expect(darkVars.has("--nyx-bg")).toBe(true);
      expect(darkVars.get("--nyx-bg")).toBe("#1C1C1E");
    });

    it("determinism across fixture documents after dark/light separation", () => {
      for (const content of [APPLE, DYLAN, SHOPVIBE]) {
        const doc = runDesignPipelineCached(content);
        const css1 = buildShowcaseCSS(doc);
        const css2 = buildShowcaseCSS(doc);
        expect(css1).toBe(css2);
      }
    });
  });

  describe("per-variable candidate scoring — acceptance criteria", () => {
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

    function isNeutralGray(value: string): boolean {
      const m = value.match(/^#([0-9a-f]{6})$/i);
      if (!m) return false;
      const r = parseInt(m[1]!.slice(0, 2), 16);
      const g = parseInt(m[1]!.slice(2, 4), 16);
      const b = parseInt(m[1]!.slice(4, 6), 16);
      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      return maxDiff < 30;
    }

    function isFuchsiaDerived(value: string): boolean {
      const m = value.match(/^#([0-9a-f]{6})$/i);
      if (!m) return false;
      const r = parseInt(m[1]!.slice(0, 2), 16);
      const g = parseInt(m[1]!.slice(2, 4), 16);
      const b = parseInt(m[1]!.slice(4, 6), 16);
      return r > 150 && b > 150 && g < 100;
    }

    function isOrangeDerived(value: string): boolean {
      const m = value.match(/^#([0-9a-f]{6})$/i);
      if (!m) return false;
      const r = parseInt(m[1]!.slice(0, 2), 16);
      const g = parseInt(m[1]!.slice(2, 4), 16);
      const b = parseInt(m[1]!.slice(4, 6), 16);
      return r > 150 && g > 80 && b < 100;
    }

    function isBlue(value: string): boolean {
      const m = value.match(/^#([0-9a-f]{6})$/i);
      if (!m) return false;
      const r = parseInt(m[1]!.slice(0, 2), 16);
      const g = parseInt(m[1]!.slice(2, 4), 16);
      const b = parseInt(m[1]!.slice(4, 6), 16);
      return b > 150 && r < 100 && g < 150;
    }

    it("ShopVibe light: text-muted is neutral gray, not cyan (#22D3EE)", () => {
      const doc = runDesignPipelineCached(SHOPVIBE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const textMuted = lightVars.get("--nyx-text-muted");
      expect(textMuted).toBeDefined();
      expect(textMuted).not.toBe("#22D3EE");
      if (textMuted && textMuted.startsWith("#")) {
        expect(isNeutralGray(textMuted)).toBe(true);
      }
    });

    it("ShopVibe light: text-dim is neutral gray, not yellow (#FACC15)", () => {
      const doc = runDesignPipelineCached(SHOPVIBE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const textDim = lightVars.get("--nyx-text-dim");
      expect(textDim).toBeDefined();
      expect(textDim).not.toBe("#FACC15");
      if (textDim && textDim.startsWith("#")) {
        expect(isNeutralGray(textDim)).toBe(true);
      }
    });

    it("ShopVibe dark: text-muted is neutral gray, not cyan", () => {
      const doc = runDesignPipelineCached(SHOPVIBE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const textMuted = darkVars.get("--nyx-text-muted");
      expect(textMuted).toBeDefined();
      expect(textMuted).not.toBe("#22D3EE");
    });

    it("ShopVibe dark: text-dim is neutral gray, not yellow", () => {
      const doc = runDesignPipelineCached(SHOPVIBE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const textDim = darkVars.get("--nyx-text-dim");
      expect(textDim).toBeDefined();
      expect(textDim).not.toBe("#FACC15");
    });

    it("ShopVibe button hover is fuchsia-derived, not nyx blue", () => {
      const doc = runDesignPipelineCached(SHOPVIBE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const accentHover = lightVars.get("--nyx-accent-hover");
      expect(accentHover).toBeDefined();
      expect(accentHover).not.toBe("#0369a1");
      expect(accentHover).not.toBe("#0ea5e9");
      expect(accentHover).not.toBe("#38bdf8");
    });

    it("ShopVibe dark button hover is fuchsia-derived, not blue", () => {
      const doc = runDesignPipelineCached(SHOPVIBE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const accentHover = darkVars.get("--nyx-accent-hover");
      expect(accentHover).toBeDefined();
      expect(accentHover).not.toBe("#0369a1");
      expect(accentHover).not.toBe("#0ea5e9");
      expect(accentHover).not.toBe("#38bdf8");
    });

    it("Dylanbrouwer button hover is warm/terracotta-derived, not blue", () => {
      const doc = runDesignPipelineCached(DYLAN);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const accentHover = lightVars.get("--nyx-accent-hover");
      expect(accentHover).toBeDefined();
      expect(accentHover).not.toBe("#0369a1");
      expect(accentHover).not.toBe("#0ea5e9");
      expect(accentHover).not.toBe("#38bdf8");
    });

    it("Apple light bg uses canvas/surface token, not dark tile", () => {
      const doc = runDesignPipelineCached(APPLE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const bg = lightVars.get("--nyx-bg");
      const surface = lightVars.get("--nyx-surface");
      expect(bg).toBeDefined();
      expect(surface).toBeDefined();
      if (bg) {
        const dark = isColorDark(bg);
        if (dark !== null) expect(dark).toBe(false);
      }
    });

    it("Apple dark surface is dark, not white", () => {
      const doc = runDesignPipelineCached(APPLE);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const surface = darkVars.get("--nyx-surface");
      expect(surface).toBeDefined();
      if (surface && surface.startsWith("#")) {
        expect(isColorDark(surface)).toBe(true);
      }
    });

    it("component recipe button hover overrides generic token guess", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [
            makeColorToken("Primary", "#5B5FC7"),
            makeColorToken("Primary Hover", "#4A4EB5"),
          ],
          componentRecipes: [
            {
              name: "button-primary",
              properties: {
                backgroundColor: "#5B5FC7",
                "hover-background": "#C026D3",
              },
              provenance: { extractor: "yaml" },
            },
          ],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      expect(lightVars.get("--nyx-accent-hover")).toBe("#C026D3");
    });

    it("radius Small does not map to button radius", () => {
      const result = mapRadiusToken({ name: "Small", value: "4px" });
      expect(result).not.toBeNull();
      expect(result![0]).not.toBe("--nyx-radius-btn");
      expect(result![0]).toBe("--nyx-radius-input");
    });

    it("radius Small maps to input radius", () => {
      const result = mapRadiusToken({ name: "Small", value: "4px" });
      expect(result).not.toBeNull();
      expect(result![0]).toBe("--nyx-radius-input");
      expect(result![1]).toBe("4px");
    });

    it("radius with button in name maps to button radius", () => {
      const result = mapRadiusToken({ name: "Button Radius", value: "8px" });
      expect(result).not.toBeNull();
      expect(result![0]).toBe("--nyx-radius-btn");
    });

    it("radius None 0px maps to global zero radius", () => {
      const result = mapRadiusToken({ name: "None", value: "0px" });
      expect(result).not.toBeNull();
      expect(result![0]).toBe("--nyx-radius-global-zero");
      expect(result![1]).toBe("0px");
    });

    it("radius None with value 'none' normalizes to 0px", () => {
      const result = mapRadiusToken({ name: "None", value: "none" });
      expect(result).not.toBeNull();
      expect(result![0]).toBe("--nyx-radius-global-zero");
      expect(result![1]).toBe("0px");
    });

    it("radius None with value '0' normalizes to 0px", () => {
      const result = mapRadiusToken({ name: "None", value: "0" });
      expect(result).not.toBeNull();
      expect(result![0]).toBe("--nyx-radius-global-zero");
      expect(result![1]).toBe("0px");
    });

    it("radius Full 9999px maps to badge radius", () => {
      const result = mapRadiusToken({ name: "Full", value: "9999px" });
      expect(result).not.toBeNull();
      expect(result![0]).toBe("--nyx-radius-badge");
      expect(result![1]).toBe("9999px");
    });

    it("component recipe button radius wins over generic radius token", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [],
          radiusTokens: [
            { name: "Small", value: "4px", provenance: { extractor: "yaml" } },
            { name: "Medium", value: "8px", provenance: { extractor: "yaml" } },
          ],
          componentRecipes: [
            {
              name: "button-primary",
              properties: { borderRadius: "9999px" },
              provenance: { extractor: "yaml" },
            },
          ],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-radius-btn:9999px");
    });

    it("normalizes CSS border value for input border", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [],
          componentRecipes: [
            {
              name: "text-input",
              properties: { border: "1.5px solid #D4D4D4" },
              provenance: { extractor: "yaml" },
            },
          ],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      expect(css).toContain("--nyx-input-border:#D4D4D4");
    });

    it("isTextLikeToken returns true for text tokens", () => {
      expect(isTextLikeToken(makeColorToken("Text Primary", "#000"))).toBe(true);
      expect(isTextLikeToken(makeColorToken("Text Muted", "#666"))).toBe(true);
      expect(isTextLikeToken(makeColorToken("Ink", "#111"))).toBe(true);
      expect(isTextLikeToken(makeColorToken("Foreground", "#222"))).toBe(true);
      expect(isTextLikeToken(makeColorToken("On-Surface", "#fff"))).toBe(true);
    });

    it("isTextLikeToken returns false for palette accent tokens", () => {
      expect(isTextLikeToken(makeColorToken("Secondary", "#22D3EE"))).toBe(false);
      expect(isTextLikeToken(makeColorToken("Tertiary", "#FACC15"))).toBe(false);
      expect(isTextLikeToken(makeColorToken("Primary", "#D946EF"))).toBe(false);
    });

    it("isPaletteAccentToken returns true for secondary/tertiary palette tokens", () => {
      expect(isPaletteAccentToken(makeColorToken("Secondary", "#22D3EE"))).toBe(true);
      expect(isPaletteAccentToken(makeColorToken("Tertiary", "#FACC15"))).toBe(true);
    });

    it("isPaletteAccentToken returns false for text tokens even with secondary/tertiary in name", () => {
      expect(isPaletteAccentToken(makeColorToken("Text Secondary", "#6B7280"))).toBe(false);
      expect(isPaletteAccentToken(makeColorToken("Text Tertiary", "#9CA3AF"))).toBe(false);
    });

    it("text-head and text-body can both be set without global claiming blocking reuse", () => {
      const tokens = [
        makeColorToken("Text Primary", "#1D1D1F"),
        makeColorToken("Text Body", "#2D2D2F"),
        makeColorToken("Background", "#FFFFFF"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const textHead = lightVars.get("--nyx-text-head");
      const textBody = lightVars.get("--nyx-text-body");
      expect(textHead).toBe("#1D1D1F");
      expect(textBody).toBe("#2D2D2F");
    });

    it("same generic text token can serve both head and body when no specific tokens exist", () => {
      const tokens = [
        makeColorToken("Ink", "#1D1D1F"),
        makeColorToken("Background", "#FFFFFF"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const textHead = lightVars.get("--nyx-text-head");
      expect(textHead).toBe("#1D1D1F");
    });
  });

  describe("background/surface mapping — reject semantic tints and dark tokens in light mode", () => {
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

    it("synthetic fixture: page background maps to Page Background, not Accent bg", () => {
      const tokens = [
        makeColorToken("Accent bg", "rgba(14,165,233,0.15)"),
        makeColorToken("Positive bg", "rgba(34,197,94,0.1)"),
        makeColorToken("Page Background", "#FAFAFA"),
        makeColorToken("Surface", "#FFFFFF"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const bg = lightVars.get("--nyx-bg");
      expect(bg).toBe("#FAFAFA");
      expect(bg).not.toBe("rgba(14,165,233,0.15)");
      expect(bg).not.toBe("rgba(34,197,94,0.1)");
    });

    it("synthetic fixture: semantic tint tokens never map to --nyx-surface", () => {
      const tokens = [
        makeColorToken("Accent bg", "rgba(14,165,233,0.15)"),
        makeColorToken("Warning bg", "rgba(234,179,8,0.1)"),
        makeColorToken("Error bg", "rgba(220,38,38,0.1)"),
        makeColorToken("Callout bg", "rgba(99,102,241,0.08)"),
        makeColorToken("Tag bg", "rgba(107,114,128,0.08)"),
        makeColorToken("Badge bg", "rgba(168,85,247,0.1)"),
        makeColorToken("Card Surface", "#FFFFFF"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const surface = lightVars.get("--nyx-surface");
      expect(surface).toBe("#FFFFFF");
      expect(surface).not.toBe("rgba(14,165,233,0.15)");
      expect(surface).not.toBe("rgba(234,179,8,0.1)");
      expect(surface).not.toBe("rgba(220,38,38,0.1)");
      expect(surface).not.toBe("rgba(99,102,241,0.08)");
      expect(surface).not.toBe("rgba(107,114,128,0.08)");
      expect(surface).not.toBe("rgba(168,85,247,0.1)");
    });

    it("apple-like fixture: light surface does not use dark tile", () => {
      const tokens = [
        makeColorToken("canvas", "#F5F5F0"),
        makeColorToken("canvas-parchment", "#FAF8F3"),
        makeColorToken("surface-tile-1", "#2C2C2E"),
        makeColorToken("store-utility-card", "#FFFFFF"),
        makeColorToken("Text Primary", "#1D1D1F"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const surface = lightVars.get("--nyx-surface");
      const bg = lightVars.get("--nyx-bg");
      expect(surface).toBeDefined();
      if (surface) {
        const dark = isColorDark(surface);
        if (dark !== null) expect(dark).toBe(false);
      }
      expect(surface).not.toBe("#2C2C2E");
      expect(surface).toBe("#FFFFFF");
      if (bg) {
        const dark = isColorDark(bg);
        if (dark !== null) expect(dark).toBe(false);
      }
    });

    it("nyx-like dark-only fixture: light --nyx-bg is not accent tint rgba", () => {
      const tokens = [
        makeColorToken("accent", "#0ea5e9"),
        makeColorToken("accent bg", "rgba(14,165,233,0.15)"),
        makeColorToken("surface", "#1a1a2e"),
        makeColorToken("surface dark", "#0f0f1a"),
        makeColorToken("text", "#e2e8f0"),
        makeColorToken("text on dark", "#f8fafc"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const bg = lightVars.get("--nyx-bg");
      expect(bg).toBeDefined();
      if (bg) {
        expect(bg).not.toBe("rgba(14,165,233,0.15)");
        const c = parseColor(bg);
        if (c) {
          const isAccentTint = Math.abs(c.r - 14) < 20 && Math.abs(c.g - 165) < 20 && Math.abs(c.b - 233) < 20 && c.a < 0.5;
          expect(isAccentTint).toBe(false);
        }
      }
    });

    it("light mode rejects tokens with 'dark' in name for --nyx-bg", () => {
      const tokens = [
        makeColorToken("Background Dark", "#1C1C1E"),
        makeColorToken("Surface", "#FFFFFF"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const bg = lightVars.get("--nyx-bg");
      expect(bg).not.toBe("#1C1C1E");
    });

    it("light mode rejects tokens with 'dark' in name for --nyx-surface", () => {
      const tokens = [
        makeColorToken("Surface Dark", "#1C1C1E"),
        makeColorToken("Card", "#FFFFFF"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const surface = lightVars.get("--nyx-surface");
      expect(surface).not.toBe("#1C1C1E");
    });

    it("dark mode uses explicit dark tokens when available", () => {
      const tokens = [
        makeColorToken("Background", "#FFFFFF"),
        makeColorToken("Background Dark", "#0f0f1a"),
        makeColorToken("Surface", "#F8F8F8"),
        makeColorToken("Surface Dark", "#1a1a2e"),
        makeColorToken("Text Primary", "#1D1D1F"),
        makeColorToken("Text on Dark", "#F5F5F7"),
        makeColorToken("Primary", "#007AFF"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      expect(darkVars.get("--nyx-bg")).toBe("#0f0f1a");
      expect(darkVars.get("--nyx-surface")).toBe("#1a1a2e");
    });

    it("ThoughtStream-style warm backgrounds preserved", () => {
      const tokens = [
        makeColorToken("Background", "#FAF8F5"),
        makeColorToken("Surface", "#FFFFFF"),
        makeColorToken("Surface Warm", "#FDF8F0"),
        makeColorToken("Text Primary", "#2D2A26"),
        makeColorToken("Text Muted", "#7C756D"),
        makeColorToken("Accent", "#B84E3E"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      expect(lightVars.get("--nyx-bg")).toBe("#FAF8F5");
      expect(lightVars.get("--nyx-surface")).toBe("#FFFFFF");
    });

    it("ShopVibe-style light/dark surfaces preserved", () => {
      const tokens = [
        makeColorToken("Background", "#FFFFFF"),
        makeColorToken("Background Dark", "#0A0A0F"),
        makeColorToken("Surface", "#F8F8FC"),
        makeColorToken("Surface Dark", "#12121A"),
        makeColorToken("Primary", "#D946EF"),
        makeColorToken("Text Primary", "#17191C"),
        makeColorToken("Text on Dark", "#F5F5F7"),
      ];
      const doc = makeDoc(tokens);
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const darkVars = extractThemeBlock(css!, "dark");
      expect(lightVars.get("--nyx-bg")).toBe("#FFFFFF");
      expect(lightVars.get("--nyx-surface")).toBe("#F8F8FC");
      expect(darkVars.get("--nyx-bg")).toBe("#0A0A0F");
      expect(darkVars.get("--nyx-surface")).toBe("#12121A");
    });
  });

  describe("isGenericCardRecipe", () => {
    it("returns true for plain 'card'", () => {
      expect(isGenericCardRecipe("card", {})).toBe(true);
    });

    it("returns true for 'default card'", () => {
      expect(isGenericCardRecipe("default card", {})).toBe(true);
    });

    it("returns true for 'base card'", () => {
      expect(isGenericCardRecipe("base-card", {})).toBe(true);
    });

    it("returns true for 'reader card'", () => {
      expect(isGenericCardRecipe("reader-card", {})).toBe(true);
    });

    it("returns true for 'card' with card family property", () => {
      expect(isGenericCardRecipe("card", { family: "card" })).toBe(true);
    });

    it("returns false for 'product-tile-dark'", () => {
      expect(isGenericCardRecipe("product-tile-dark", {})).toBe(false);
    });

    it("returns true for 'store-utility-card'", () => {
      expect(isGenericCardRecipe("store-utility-card", {})).toBe(true);
    });

    it("returns false for 'frosted feature card'", () => {
      expect(isGenericCardRecipe("frosted-feature-card", {})).toBe(false);
    });

    it("returns false for 'hero-banner'", () => {
      expect(isGenericCardRecipe("hero-banner", {})).toBe(false);
    });

    it("returns false for 'quote card'", () => {
      expect(isGenericCardRecipe("quote-card", {})).toBe(false);
    });

    it("returns false for 'gallery item'", () => {
      expect(isGenericCardRecipe("gallery-item", {})).toBe(false);
    });

    it("returns false for 'pricing card'", () => {
      expect(isGenericCardRecipe("pricing-card", {})).toBe(false);
    });

    it("returns false for 'overlay'", () => {
      expect(isGenericCardRecipe("overlay", {})).toBe(false);
    });

    it("returns false for 'environment'", () => {
      expect(isGenericCardRecipe("environment", {})).toBe(false);
    });

    it("returns false for 'dark card' variant", () => {
      expect(isGenericCardRecipe("dark-card", {})).toBe(false);
    });

    it("returns false for 'light card' variant", () => {
      expect(isGenericCardRecipe("light-card", {})).toBe(false);
    });

    it("returns false for 'profile card'", () => {
      expect(isGenericCardRecipe("profile-card", {})).toBe(false);
    });

    it("returns false for 'stat card'", () => {
      expect(isGenericCardRecipe("stat-card", {})).toBe(false);
    });

    it("returns false for 'banner card'", () => {
      expect(isGenericCardRecipe("banner-card", {})).toBe(false);
    });

    it("returns false for 'sidebar card'", () => {
      expect(isGenericCardRecipe("sidebar-card", {})).toBe(false);
    });

    it("returns false for 'glass card'", () => {
      expect(isGenericCardRecipe("glass-card", {})).toBe(false);
    });

    it("returns false for 'testimonial card'", () => {
      expect(isGenericCardRecipe("testimonial-card", {})).toBe(false);
    });

    it("returns false for 'media card'", () => {
      expect(isGenericCardRecipe("media-card", {})).toBe(false);
    });

    it("returns false for 'photo card'", () => {
      expect(isGenericCardRecipe("photo-card", {})).toBe(false);
    });

    it("returns false for 'review card'", () => {
      expect(isGenericCardRecipe("review-card", {})).toBe(false);
    });

    it("returns false for 'notification card'", () => {
      expect(isGenericCardRecipe("notification-card", {})).toBe(false);
    });

    it("returns false for 'modal'", () => {
      expect(isGenericCardRecipe("modal", {})).toBe(false);
    });

    it("returns false for 'dialog'", () => {
      expect(isGenericCardRecipe("dialog", {})).toBe(false);
    });

    it("returns false for 'popover'", () => {
      expect(isGenericCardRecipe("popover", {})).toBe(false);
    });

    it("returns false for 'promo card'", () => {
      expect(isGenericCardRecipe("promo-card", {})).toBe(false);
    });

    it("returns false for 'metric card'", () => {
      expect(isGenericCardRecipe("metric-card", {})).toBe(false);
    });

    it("returns false for 'kpi card'", () => {
      expect(isGenericCardRecipe("kpi-card", {})).toBe(false);
    });

    it("returns false for 'counter card'", () => {
      expect(isGenericCardRecipe("counter-card", {})).toBe(false);
    });

    it("returns false for 'announcement card'", () => {
      expect(isGenericCardRecipe("announcement-card", {})).toBe(false);
    });

    it("returns false for 'nav card'", () => {
      expect(isGenericCardRecipe("nav-card", {})).toBe(false);
    });

    it("returns false for 'menu card'", () => {
      expect(isGenericCardRecipe("menu-card", {})).toBe(false);
    });

    it("returns false for 'footer card'", () => {
      expect(isGenericCardRecipe("footer-card", {})).toBe(false);
    });

    it("returns false for 'header card'", () => {
      expect(isGenericCardRecipe("header-card", {})).toBe(false);
    });

    it("returns false for 'feature block'", () => {
      expect(isGenericCardRecipe("feature-block", {})).toBe(false);
    });

    it("returns false for 'glassmorphism card'", () => {
      expect(isGenericCardRecipe("glassmorphism-card", {})).toBe(false);
    });

    it("returns false for 'scene'", () => {
      expect(isGenericCardRecipe("scene", {})).toBe(false);
    });

    it("returns false for 'backdrop'", () => {
      expect(isGenericCardRecipe("backdrop", {})).toBe(false);
    });

    it("returns true for 'tile' (plain)", () => {
      expect(isGenericCardRecipe("tile", {})).toBe(true);
    });

    it("returns true for 'panel' (plain)", () => {
      expect(isGenericCardRecipe("panel", {})).toBe(true);
    });

    it("returns true for 'generic card'", () => {
      expect(isGenericCardRecipe("generic-card", {})).toBe(true);
    });

    it("returns true for 'standard card'", () => {
      expect(isGenericCardRecipe("standard-card", {})).toBe(true);
    });

    it("returns true for 'normal card'", () => {
      expect(isGenericCardRecipe("normal-card", {})).toBe(true);
    });
  });

  describe("specialized card recipes do not leak global surface", () => {
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

    it("apple-like fixture: light surface maps from generic utility card, not product-tile-dark", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [
            makeColorToken("canvas", "#F5F5F0"),
            makeColorToken("store-utility-card", "#FFFFFF"),
            makeColorToken("Text Primary", "#1D1D1F"),
            makeColorToken("Primary", "#007AFF"),
          ],
          componentRecipes: [
            {
              name: "product-tile-dark",
              properties: {
                borderRadius: "20px",
                backgroundColor: "#1C1C1E",
              },
              provenance: { extractor: "yaml" },
            },
            {
              name: "store-utility-card",
              properties: {
                borderRadius: "16px",
                backgroundColor: "#FFFFFF",
              },
              provenance: { extractor: "yaml" },
            },
          ],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      const surface = lightVars.get("--nyx-surface");
      expect(surface).toBeDefined();
      expect(surface).not.toBe("#1C1C1E");
      expect(surface).toBe("#FFFFFF");
    });

    it("dylanbrouwer-like fixture: frosted feature card does not force white surface in dark mode", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [
            makeColorToken("Background", "#1A1A1A"),
            makeColorToken("Surface", "#242424"),
            makeColorToken("Text Primary", "#F5F5F7"),
            makeColorToken("Primary", "#B84E3E"),
          ],
          componentRecipes: [
            {
              name: "frosted-feature-card",
              properties: {
                borderRadius: "24px",
                backgroundColor: "rgba(255,255,255,0.5)",
              },
              provenance: { extractor: "yaml" },
            },
          ],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const darkVars = extractThemeBlock(css!, "dark");
      const surface = darkVars.get("--nyx-surface");
      expect(surface).toBeDefined();
      expect(surface).not.toBe("rgba(255,255,255,0.5)");
      expect(surface).not.toBe("#ffffff");
      expect(surface).not.toBe("#FFFFFF");
    });

    it("shopvibe default card still maps card radius and background correctly", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [
            makeColorToken("Background", "#FFFFFF"),
            makeColorToken("Surface", "#F8F8FC"),
            makeColorToken("Text Primary", "#17191C"),
            makeColorToken("Primary", "#D946EF"),
          ],
          componentRecipes: [
            {
              name: "default-card",
              properties: {
                borderRadius: "12px",
                backgroundColor: "#F8F8FC",
              },
              provenance: { extractor: "yaml" },
            },
          ],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      expect(lightVars.get("--nyx-radius-card")).toBe("12px");
      expect(lightVars.get("--nyx-surface")).toBe("#F8F8FC");
    });

    it("multiple card recipes: generic card wins for surface, specialized ignored", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [
            makeColorToken("Background", "#FAFAFA"),
            makeColorToken("Surface", "#FFFFFF"),
            makeColorToken("Text Primary", "#1D1D1F"),
            makeColorToken("Primary", "#007AFF"),
          ],
          componentRecipes: [
            {
              name: "product-tile-dark",
              properties: {
                borderRadius: "20px",
                backgroundColor: "#2C2C2E",
                borderColor: "#3A3A3C",
              },
              provenance: { extractor: "yaml" },
            },
            {
              name: "hero-banner",
              properties: {
                borderRadius: "0px",
                backgroundColor: "linear-gradient(to right, #667eea, #764ba2)",
              },
              provenance: { extractor: "yaml" },
            },
            {
              name: "card",
              properties: {
                borderRadius: "16px",
                backgroundColor: "#FFFFFF",
                padding: "24px",
              },
              provenance: { extractor: "yaml" },
            },
          ],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      expect(lightVars.get("--nyx-surface")).toBe("#FFFFFF");
      expect(lightVars.get("--nyx-radius-card")).toBe("16px");
      expect(lightVars.get("--nyx-card-padding")).toBe("24px");
    });

    it("specialized card border-color does not leak into global card-highlight-border", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [
            makeColorToken("Background", "#FAFAFA"),
            makeColorToken("Surface", "#FFFFFF"),
            makeColorToken("Text Primary", "#1D1D1F"),
            makeColorToken("Primary", "#007AFF"),
          ],
          componentRecipes: [
            {
              name: "product-tile-dark",
              properties: {
                borderRadius: "20px",
                backgroundColor: "#1C1C1E",
                borderColor: "#3A3A3C",
              },
              provenance: { extractor: "yaml" },
            },
          ],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      expect(lightVars.get("--nyx-card-highlight-border")).not.toBe("#3A3A3C");
      expect(lightVars.get("--nyx-surface")).toBe("#FFFFFF");
    });

    it("specialized card padding does not leak into global card-padding", () => {
      const doc: DesignDocument = {
        meta: { name: "Test", description: "", sourceLength: 0 },
        detection: { score: 1, signals: [] },
        diagnostics: [],
        _sourceContent: "",
        spec: {
          colors: {},
          typography: {},
          spacing: {},
          radii: {},
          layout: {},
          raw: {},
          colorTokens: [
            makeColorToken("Background", "#FAFAFA"),
            makeColorToken("Surface", "#FFFFFF"),
            makeColorToken("Text Primary", "#1D1D1F"),
            makeColorToken("Primary", "#007AFF"),
          ],
          componentRecipes: [
            {
              name: "feature-card",
              properties: {
                borderRadius: "24px",
                backgroundColor: "rgba(255,255,255,0.08)",
                padding: "32px",
              },
              provenance: { extractor: "yaml" },
            },
          ],
        },
      };
      const css = buildShowcaseCSS(doc);
      expect(css).not.toBeNull();
      const lightVars = extractThemeBlock(css!, "light");
      expect(lightVars.get("--nyx-card-padding")).toBeUndefined();
      expect(lightVars.get("--nyx-surface")).toBe("#FFFFFF");
    });
  });
});
