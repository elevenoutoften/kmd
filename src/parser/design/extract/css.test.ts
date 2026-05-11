import { describe, it, expect } from "vitest";
import { extractCssFromContent } from "./css";
import { readFileSync } from "fs";
import { join } from "path";

const FIXTURES_DIR = join(__dirname, "../../../../fixtures");

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

describe("extractCss", () => {
  it("extracts colors from :root block in dylanbrouwer fixture", () => {
    const content = readFixture("dylanbrouwer-DESIGN.md");
    const doc = extractCssFromContent(content);

    const colorNames = (doc.spec.colorTokens ?? []).map((t) => t.name);
    expect(colorNames).toContain("canvas");
    expect(colorNames).toContain("ink");
    expect(colorNames).toContain("graphite");
    expect(colorNames).toContain("warm-mist");
    expect(colorNames).toContain("terracotta");

    // Check flat map too.
    expect(doc.spec.colors["canvas"]).toBe("#ffffff");
    expect(doc.spec.colors["ink"]).toBe("#17191c");
  });

  it("extracts spacing tokens from :root block", () => {
    const content = readFixture("dylanbrouwer-DESIGN.md");
    const doc = extractCssFromContent(content);

    const spacingNames = (doc.spec.spacingTokens ?? []).map((t) => t.name);
    expect(spacingNames).toContain("4");
    expect(spacingNames).toContain("8");
    expect(spacingNames).toContain("16");
    expect(spacingNames).toContain("32");
    expect(spacingNames).toContain("40");

    expect(doc.spec.spacing["4"]).toBe("4px");
    expect(doc.spec.spacing["40"]).toBe("40px");
  });

  it("extracts radius tokens from :root block", () => {
    const content = readFixture("dylanbrouwer-DESIGN.md");
    const doc = extractCssFromContent(content);

    const radiusNames = (doc.spec.radiusTokens ?? []).map((t) => t.name);
    expect(radiusNames).toContain("card");
    expect(radiusNames).toContain("image");
    expect(radiusNames).toContain("button");

    expect(doc.spec.radii["button"]).toBe("9999px");
  });

  it("extracts font (typography) tokens from :root block", () => {
    const content = readFixture("dylanbrouwer-DESIGN.md");
    const doc = extractCssFromContent(content);

    const typoNames = (doc.spec.typographyTokens ?? []).map((t) => t.name);
    expect(typoNames).toContain("font-sohne");
    expect(typoNames).toContain("font-signifier");
    expect(typoNames).toContain("text-caption");
    expect(typoNames).toContain("text-heading");
    expect(typoNames).toContain("text-body");
    expect(typoNames).toContain("leading-normal");
    expect(typoNames).toContain("leading-tight");
    expect(typoNames).toContain("tracking-tight");
  });

  it("extracts shadow (elevation) tokens from :root block", () => {
    const content = readFixture("dylanbrouwer-DESIGN.md");
    const doc = extractCssFromContent(content);

    const elevNames = (doc.spec.elevationTokens ?? []).map((t) => t.name);
    expect(elevNames).toContain("subtle");
    expect(elevNames).toContain("medium");
    expect(elevNames).toContain("large");
  });

  it("extracts from both :root and @theme blocks", () => {
    const content = readFixture("dylanbrouwer-DESIGN.md");
    const doc = extractCssFromContent(content);

    // The :root block has 10 colors; @theme adds 3 more (canvas, ink, warm-mist)
    // but duplicates are allowed (pipeline merges later).
    const colors = doc.spec.colorTokens ?? [];
    // At least the :root ones.
    expect(colors.length).toBeGreaterThanOrEqual(10);

    // @theme block tokens should also be present.
    const colorNames = colors.map((t) => t.name);
    // canvas appears in both :root and @theme
    const canvasCount = colorNames.filter((n) => n === "canvas").length;
    expect(canvasCount).toBe(2);
  });

  it("puts unknown namespaces into spec.unknown", () => {
    const content = `
\`\`\`css
:root {
  --color-primary: #ff0000;
  --z-mystery: 999;
  --animation-speed: 300ms;
}
\`\`\`
`;
    const doc = extractCssFromContent(content);

    expect(doc.spec.colors["primary"]).toBe("#ff0000");
    expect(doc.spec.unknown).toBeDefined();
    expect(doc.spec.unknown!["--z-mystery"]).toBe("999");
    expect(doc.spec.unknown!["--animation-speed"]).toBe("300ms");
  });

  it("skips non-CSS code blocks", () => {
    const content = `
\`\`\`javascript
const x = "--color-primary: #ff0000;";
\`\`\`
`;
    const doc = extractCssFromContent(content);
    expect(doc.spec.colorTokens ?? []).toHaveLength(0);
  });

  it("recognises unlabeled code blocks containing :root {", () => {
    const content = `
\`\`\`
:root {
  --color-accent: #00ff00;
}
\`\`\`
`;
    const doc = extractCssFromContent(content);
    expect(doc.spec.colorTokens ?? []).toHaveLength(1);
    expect(doc.spec.colors["accent"]).toBe("#00ff00");
  });
});
