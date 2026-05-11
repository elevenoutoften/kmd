import { describe, it, expect } from "vitest";
import { parseMarkdown, detectMath } from "./index";

describe("parseMarkdown options", () => {
  it("returns hasMath true for math content", async () => {
    const result = await parseMarkdown("$E = mc^2$");
    expect(result.hasMath).toBe(true);
  });

  it("returns hasMath false for plain content", async () => {
    const result = await parseMarkdown("# Hello\n\nJust text.");
    expect(result.hasMath).toBe(false);
  });

  it("skipShiki produces plain code blocks without syntax highlighting", async () => {
    const md = "```js\nconst x = 1;\n```";
    const quick = await parseMarkdown(md, { skipShiki: true });
    const full = await parseMarkdown(md);

    expect(quick.html).toContain("const x = 1;");
    expect(quick.html).not.toContain("shiki-code-block");

    expect(full.html).toContain("shiki-code-block");
    expect(full.html).toContain('data-language="js"');
  });

  it("skipMermaid leaves mermaid code blocks as plain pre/code", async () => {
    const md = "```mermaid\ngraph TD; A-->B;\n```";
    const quick = await parseMarkdown(md, { skipMermaid: true });
    const full = await parseMarkdown(md);

    expect(quick.html).toContain("graph TD");
    expect(full.html).toContain("mermaid-placeholder");
    expect(quick.html).not.toContain("mermaid-placeholder");
  });

  it("quick parse produces same outline as full parse", async () => {
    const md = "# Title\n\n## Section 1\n\n### Subsection\n\n## Section 2\n";
    const quick = await parseMarkdown(md, { skipShiki: true, skipMermaid: true });
    const full = await parseMarkdown(md);

    expect(quick.outline).toEqual(full.outline);
  });
});

describe("detectMath", () => {
  it("detects inline math", () => {
    expect(detectMath("$x = 1$")).toBe(true);
  });

  it("detects display math", () => {
    expect(detectMath("$$\nE = mc^2\n$$")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(detectMath("# Hello\n\nNo math here.")).toBe(false);
  });

  it("ignores math in YAML front matter", () => {
    const content = "---\ntitle: $test$\n---\n\nNo math here.";
    expect(detectMath(content)).toBe(false);
  });
});
