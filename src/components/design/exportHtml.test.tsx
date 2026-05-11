import { describe, expect, it } from "vitest";
import SHOPVIBE from "../../../fixtures/shopvibe-DESIGN.md?raw";
import { runDesignPipelineCached, type DesignDocument } from "../../parser/design";
import {
  buildDesignCatalogHtml,
  ensureHtmlFilename,
  ensureHtmlPath,
  suggestDesignExportFilename,
} from "./exportHtml";

describe("Design Mode HTML export", () => {
  it("builds a standalone HTML document with static and token-applied catalog styles", () => {
    const doc = runDesignPipelineCached(SHOPVIBE);
    const html = buildDesignCatalogHtml(doc, {
      theme: "dark",
      title: "shopvibe-DESIGN.md",
      catalogCss: ".nyx-btn-primary { background: var(--nyx-accent); }",
    });

    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<html lang="en" data-theme="dark">');
    expect(html).toContain("<title>shopvibe-DESIGN.md</title>");
    expect(html).toContain("nyx-showcase");
    expect(html).toContain(".nyx-btn-primary");
    expect(html).toContain("--nyx-font-display:Poppins");
    expect(html).toContain("--nyx-font-body:Nunito");
    expect(html).toContain(
      'href="https://fonts.googleapis.com/css2?family=Poppins&amp;display=swap"',
    );
    expect(html).not.toContain("<script");
  });

  it("escapes document metadata and rejects unsafe typography CSS from the export", () => {
    const doc: DesignDocument = {
      meta: { name: "Unsafe <script>", description: "", sourceLength: 0 },
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
    const html = buildDesignCatalogHtml(doc, { theme: "light" });

    expect(html).toContain("Unsafe &lt;script&gt;");
    expect(html).toContain('<html lang="en" data-theme="light">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("body{color:red");
    expect(html).not.toContain("--nyx-font-body:Inter");
  });

  it("includes input field preview in exported HTML", () => {
    const doc = runDesignPipelineCached(SHOPVIBE);
    const html = buildDesignCatalogHtml(doc, { theme: "dark" });

    expect(html).toContain("nyx-field");
    expect(html).toContain("nyx-input-control");
    expect(html).not.toContain("<script");
  });

  it("suggests HTML filenames from document names and selected paths", () => {
    expect(suggestDesignExportFilename("apple-DESIGN.md")).toBe("apple-DESIGN.html");
    expect(suggestDesignExportFilename('bad:name?.markdown')).toBe("bad-name-.html");
    expect(suggestDesignExportFilename(null)).toBe("design-mode.html");
    expect(ensureHtmlFilename("design.htm")).toBe("design.htm");
    expect(ensureHtmlPath("C:\\tmp\\design")).toBe("C:\\tmp\\design.html");
  });
});
