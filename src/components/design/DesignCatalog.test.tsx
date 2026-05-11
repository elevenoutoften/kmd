import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { runDesignPipelineCached } from "../../parser/design";
import type { DesignDocument } from "../../parser/design";
import APPLE from "../../../fixtures/apple-DESIGN.md?raw";
import DYLAN from "../../../fixtures/dylanbrouwer-DESIGN.md?raw";
import SHOPVIBE from "../../../fixtures/shopvibe-DESIGN.md?raw";
import NYX from "../../../samples/nyx-DESIGN.md?raw";
import {
  buildGoogleFontStylesheetUrl,
  catalogOutline,
  collectDesignFontFamilyNames,
  DesignCatalog,
} from "./DesignCatalog";

function render(doc: DesignDocument): string {
  return renderToStaticMarkup(<DesignCatalog doc={doc} />);
}

function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function embeddedCss(html: string): string {
  return html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

describe("DesignCatalog", () => {
  const FIXTURES = [
    { name: "apple", content: APPLE },
    { name: "dylanbrouwer", content: DYLAN },
    { name: "shopvibe", content: SHOPVIBE },
    { name: "nyx", content: NYX },
  ] as const;

  for (const fixture of FIXTURES) {
    it(`renders without crashing for ${fixture.name}`, () => {
      const doc = runDesignPipelineCached(fixture.content);
      const html = render(doc);
      expect(html).toBeTruthy();
      expect(html).toContain("nyx-showcase");
    });
  }

  it("always renders Design tokens in action section", () => {
    for (const fixture of FIXTURES) {
      const doc = runDesignPipelineCached(fixture.content);
      const html = render(doc);
      expect(html).toContain("Design tokens in action");
      expect(html).toContain("nyx-btn-primary");
      expect(html).toContain("nyx-badge-accent");
    }
  });

  it("renders stat cards for every design system", () => {
    for (const fixture of FIXTURES) {
      const doc = runDesignPipelineCached(fixture.content);
      const html = render(doc);
      expect(html).toContain("nyx-stat-card");
    }
  });

  it("renders color swatches in data table when color tokens exist", () => {
    const doc = runDesignPipelineCached(NYX);
    const html = render(doc);
    expect(html).toContain("nyx-table-swatch");
    expect(html).toContain("nyx-table-wrap");
    expect(html).toContain("nyx-mobile-cards");
  });

  it("does not render color palette swatch grid", () => {
    const doc = runDesignPipelineCached(NYX);
    const html = render(doc);
    expect(html).not.toContain("nyx-swatch-card");
  });

  it("generates outline with expected sections", () => {
    const doc = runDesignPipelineCached(NYX);
    const outline = catalogOutline(doc);
    const texts = outline.map((e) => e.text);
    expect(texts).toContain("Tokens");
    expect(texts).toContain("Components");
    expect(texts).toContain("Inventory");
  });

  it("does not expose raw CSS variable names as visible text", () => {
    for (const fixture of FIXTURES) {
      const doc = runDesignPipelineCached(fixture.content);
      const text = visibleText(render(doc));
      const internalNames = [
        ...(doc.spec.colorTokens ?? []),
        ...(doc.spec.typographyTokens ?? []),
        ...(doc.spec.spacingTokens ?? []),
        ...(doc.spec.radiusTokens ?? []),
        ...(doc.spec.elevationTokens ?? []),
      ]
        .map((token) => token.name)
        .filter((name) => name.startsWith("--"));

      for (const tokenName of internalNames) {
        expect(text).not.toContain(tokenName);
      }
    }
  });

  it("renders hero with design system name", () => {
    const doc = runDesignPipelineCached(NYX);
    const html = render(doc);
    expect(html).toContain("Nyx Design System");
  });

  it("renders callout section", () => {
    const doc = runDesignPipelineCached(NYX);
    const html = render(doc);
    expect(html).toContain("nyx-callout");
  });

  it("keeps the About this page callout sharp-edged", () => {
    const cssPath = new URL("./DesignCatalog.css", import.meta.url);
    const css = readFileSync(cssPath, "utf8");
    expect(css).toMatch(/\.nyx-callout\s*\{[\s\S]*border-radius:\s*0;/);
  });

  it("renders buttons showcase section", () => {
    const doc = runDesignPipelineCached(APPLE);
    const html = render(doc);
    expect(html).toContain("nyx-btn-primary");
    expect(html).toContain("nyx-btn-secondary");
    expect(html).toContain("nyx-btn-ghost");
  });

  it("renders input field preview in the Tags, Badges & Buttons card", () => {
    const doc = runDesignPipelineCached(APPLE);
    const html = render(doc);
    expect(html).toContain("nyx-field");
    expect(html).toContain("nyx-input-label");
    expect(html).toContain("nyx-input-control");
    expect(html).toContain("nyx-input-helper");
  });

  it("renders Apple typography with weight and line-height CSS variables", () => {
    const doc = runDesignPipelineCached(APPLE);
    const html = render(doc);
    const css = embeddedCss(html);

    expect(html).toContain("nyx-showcase");
    expect(css).toContain("--nyx-display-weight:700");
    expect(css).toContain("--nyx-display-line:1.2");
  });

  it("promotes ShopVibe prose typography tokens to page-level CSS variables", () => {
    const doc = runDesignPipelineCached(SHOPVIBE);
    const html = render(doc);
    const css = embeddedCss(html);

    expect(css).toContain(".nyx-showcase,.design-mode-scroll");
    expect(css).toContain("--nyx-font-display:Poppins");
    expect(css).toContain('--nyx-font-display:Poppins, "Aptos Display"');
    expect(css).toContain("--nyx-display-size:56px");
    expect(css).toContain("--nyx-display-weight:800");
    expect(css).toContain("--nyx-font-body:Nunito");
    expect(css).toContain("--nyx-body-size:16px");
    expect(css).toContain("--nyx-label-track:0.08em");
    expect(html).toContain("font-family:Poppins,");
    expect(collectDesignFontFamilyNames(doc)).toEqual(["Poppins", "Nunito", "Space Mono"]);
  });

  it("promotes Dylan split CSS typography tokens to page-level CSS variables", () => {
    const doc = runDesignPipelineCached(DYLAN);
    const css = embeddedCss(render(doc));

    expect(css).toContain("--nyx-font-display:\"Signifier\", serif");
    expect(css).toContain("--nyx-font-body:\"Sohne\", system-ui, sans-serif");
    expect(css).toContain("--nyx-font-label:\"Sohne\", system-ui, sans-serif");
    expect(css).toContain("Sohne");
    expect(css).toContain("--nyx-display-size:56px");
    expect(css).toContain("--nyx-body-size:15px");
    expect(css).toContain("--nyx-label-size:12px");
    expect(css).not.toContain("font-family:size");
  });

  it("uses similar fallback stacks when a requested web font is unavailable", () => {
    const doc: DesignDocument = {
      meta: { name: "Serif Brand", description: "", sourceLength: 0 },
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
        typographyTokens: [
          {
            name: "display",
            value: "family:Recoleta; size:48px; weight:700",
            provenance: { extractor: "test" },
          },
        ],
      },
    };
    const css = embeddedCss(render(doc));

    expect(css).toContain('--nyx-font-display:Recoleta, Georgia, "Times New Roman", serif');
  });

  it("builds sanitized provider-backed web font URLs", () => {
    expect(buildGoogleFontStylesheetUrl("Space Mono")).toBe(
      "https://fonts.googleapis.com/css2?family=Space+Mono&display=swap",
    );
    expect(buildGoogleFontStylesheetUrl("M PLUS 1p")).toBe(
      "https://fonts.googleapis.com/css2?family=M+PLUS+1p&display=swap",
    );
    expect(buildGoogleFontStylesheetUrl("system-ui")).toBeUndefined();
    expect(buildGoogleFontStylesheetUrl('Inter");body{color:red')).toBeUndefined();
    expect(buildGoogleFontStylesheetUrl("Font With url(https://evil.test/font.woff2)")).toBeUndefined();
  });

  it("does not emit unsafe typography CSS values from document tokens", () => {
    const doc: DesignDocument = {
      meta: { name: "Unsafe", description: "", sourceLength: 0 },
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
        typographyTokens: [
          {
            name: "font-family",
            value: "Inter;}body{color:red",
            provenance: { extractor: "test" },
          },
          {
            name: "body",
            value: "size:16px; line-height:1.5",
            provenance: { extractor: "test" },
          },
        ],
      },
    };
    const css = embeddedCss(render(doc));

    expect(css).toContain("--nyx-body-size:16px");
    expect(css).not.toContain("body{color:red");
    expect(css).not.toContain("--nyx-font-body:Inter");
  });
});
