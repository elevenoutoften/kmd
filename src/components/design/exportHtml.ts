import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DesignDocument } from "@/parser/design";
import {
  buildGoogleFontStylesheetUrl,
  collectDesignFontFamilyNames,
  DesignCatalog,
} from "./DesignCatalog";

export interface DesignCatalogHtmlOptions {
  theme: "light" | "dark";
  title?: string;
  catalogCss?: string;
}

export function buildDesignCatalogHtml(
  doc: DesignDocument,
  options: DesignCatalogHtmlOptions,
): string {
  const name = doc.meta.name || options.title || "Design System";
  const title = options.title || `${name} Design Mode`;
  const catalogCss = options.catalogCss ?? collectDesignCatalogCss();
  const markup = renderToStaticMarkup(
    createElement(
      "div",
      { className: "design-mode-scroll" },
      createElement(
        "div",
        { className: "design-mode-content" },
        createElement(DesignCatalog, { doc }),
      ),
    ),
  );
  const fontLinks = collectDesignFontFamilyNames(doc)
    .map((family) => buildGoogleFontStylesheetUrl(family))
    .filter((url): url is string => Boolean(url))
    .map(
      (url) =>
        `<link rel="stylesheet" href="${escapeHtml(url)}" crossorigin="anonymous">`,
    )
    .join("\n  ");

  return `<!doctype html>
<html lang="en" data-theme="${options.theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="${options.theme}">
  <title>${escapeHtml(title)}</title>
  ${fontLinks}
  <style>
${getExportShellCss()}
${catalogCss}
  </style>
</head>
<body>
  <main class="kmd-export-root">
${indent(markup, 4)}
  </main>
</body>
</html>
`;
}

export function downloadDesignCatalogAsHtml(
  doc: DesignDocument,
  filename: string,
  options: DesignCatalogHtmlOptions,
): void {
  const html = buildDesignCatalogHtml(doc, options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ensureHtmlFilename(filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function suggestDesignExportFilename(documentName: string | null): string {
  const raw = documentName?.trim() || "design-mode";
  const name = raw.replace(/\.(?:md|markdown)$/i, "");
  const safe = name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return ensureHtmlFilename(safe || "design-mode");
}

export function ensureHtmlFilename(filename: string): string {
  return /\.(?:html|htm)$/i.test(filename) ? filename : `${filename}.html`;
}

export function ensureHtmlPath(path: string): string {
  return /\.(?:html|htm)$/i.test(path) ? path : `${path}.html`;
}

export function collectDesignCatalogCss(): string {
  if (typeof document === "undefined") return "";

  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssText = "";
    try {
      cssText = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n");
    } catch {
      continue;
    }

    if (isDesignCatalogCss(cssText)) {
      chunks.push(cssText);
    }
  }

  return chunks.join("\n\n");
}

function getExportShellCss(): string {
  return `
html {
  min-height: 100%;
  background: #000;
}

html[data-theme="light"] {
  background: #f5f5f7;
}

body {
  min-height: 100vh;
  margin: 0;
}

.kmd-export-root,
.kmd-export-root > .design-mode-scroll,
.kmd-export-root .design-mode-content,
.kmd-export-root .nyx-showcase {
  min-height: 100vh;
}

.kmd-export-root > .design-mode-scroll {
  overflow: visible;
}
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isDesignCatalogCss(cssText: string): boolean {
  return (
    cssText.includes(".nyx-showcase") ||
    cssText.includes(".nyx-btn-primary") ||
    cssText.includes(".design-mode-scroll")
  );
}

function indent(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
}
