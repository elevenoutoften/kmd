import { describe, expect, it } from "vitest";

type ReadTextFile = (path: URL, encoding: "utf8") => string;

// @ts-expect-error Vitest runs in Node, while the app tsconfig stays browser-only.
const { readFileSync } = (await import("node:fs")) as { readFileSync: ReadTextFile };

const appCss = readFileSync(new URL("../App.css", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("../global.css", import.meta.url), "utf8");
const designCatalogCss = readFileSync(
  new URL("../components/design/DesignCatalog.css", import.meta.url),
  "utf8"
);
const documentShellCss = readFileSync(new URL("./DocumentShell.css", import.meta.url), "utf8");
const readerCss = readFileSync(new URL("./Reader.css", import.meta.url), "utf8");

function getRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m"));
  expect(match, `Missing CSS rule for ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

function expectDeclaration(rule: string, property: string, value: RegExp): void {
  expect(rule).toMatch(new RegExp(`${property}\\s*:\\s*${value.source}\\s*;`));
}

describe("scroll containment CSS", () => {
  it("locks the document body while letting app children own scrolling", () => {
    const htmlRule = getRule(globalCss, "html");
    const bodyRule = getRule(globalCss, "body");
    const rootRule = getRule(globalCss, "#root");

    expectDeclaration(htmlRule, "height", /100%/);
    expectDeclaration(bodyRule, "height", /100%/);
    expectDeclaration(bodyRule, "overflow", /hidden/);
    expectDeclaration(rootRule, "height", /100%/);
    expectDeclaration(rootRule, "min-height", /0/);
  });

  it("gives the main app area a definite flex height", () => {
    const appShellRule = getRule(appCss, ".app-shell");
    const appMainRule = getRule(appCss, ".app-main");

    expectDeclaration(appShellRule, "height", /100%/);
    expectDeclaration(appShellRule, "min-height", /0/);
    expectDeclaration(appShellRule, "overflow", /hidden/);
    expectDeclaration(appMainRule, "display", /flex/);
    expectDeclaration(appMainRule, "min-height", /0/);
    expectDeclaration(appMainRule, "overflow", /hidden/);
  });

  it("keeps reader and design surfaces independently scrollable", () => {
    const designModeRule = getRule(appCss, ".design-mode");
    const designRule = getRule(appCss, ".design-gallery");
    const designScrollRule = getRule(designCatalogCss, ".design-mode-scroll");
    const designContentRule = getRule(designCatalogCss, ".design-mode-content");
    const showcaseRule = getRule(designCatalogCss, ".nyx-showcase");
    const layoutRule = getRule(documentShellCss, ".reader-layout");
    const documentRule = getRule(documentShellCss, ".mdr-doc");
    const bodyRule = getRule(readerCss, ".mdr-body");
    const outlineRule = getRule(documentShellCss, ".outline-sidebar");

    expectDeclaration(designModeRule, "overflow-y", /auto/);
    expectDeclaration(designModeRule, "min-height", /0/);
    expectDeclaration(designRule, "min-height", /100%/);
    expectDeclaration(designScrollRule, "flex", /1 1 auto/);
    expectDeclaration(designScrollRule, "min-width", /0/);
    expectDeclaration(designScrollRule, "min-height", /0/);
    expectDeclaration(designScrollRule, "overflow-y", /auto/);
    expectDeclaration(designScrollRule, "background-color", /var\(--nyx-bg\)/);
    expectDeclaration(designScrollRule, "width", /100%/);
    expectDeclaration(designContentRule, "min-height", /100%/);
    expect(designContentRule).not.toMatch(/padding\s*:/);
    expectDeclaration(showcaseRule, "min-height", /100%/);
    expectDeclaration(layoutRule, "height", /100%/);
    expectDeclaration(layoutRule, "min-height", /0/);
    expectDeclaration(documentRule, "flex", /1 1 auto/);
    expectDeclaration(documentRule, "min-height", /0/);
    expectDeclaration(documentRule, "overflow-y", /auto/);
    expectDeclaration(bodyRule, "padding-bottom", /calc\(var\(--space-xxl\) \+ var\(--space-md\)\)/);
    expectDeclaration(outlineRule, "min-height", /0/);
    expectDeclaration(outlineRule, "overflow-y", /auto/);
  });
});
