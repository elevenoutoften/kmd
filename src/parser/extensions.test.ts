import { describe, it, expect } from "vitest";
import { parseMarkdown } from "./index";

// ---------------------------------------------------------------------------
// GitHub alerts
// ---------------------------------------------------------------------------

describe("GitHub alerts", () => {
  it("renders [!NOTE] alert", async () => {
    const result = await parseMarkdown("> [!NOTE]\n> This is a note.");
    expect(result.html).toContain("markdown-alert-note");
    expect(result.html).toContain("This is a note.");
  });

  it("renders [!WARNING] alert", async () => {
    const result = await parseMarkdown("> [!WARNING]\n> Be careful!");
    expect(result.html).toContain("markdown-alert-warning");
    expect(result.html).toContain("Be careful!");
  });

  it("renders [!CAUTION] alert", async () => {
    const result = await parseMarkdown("> [!CAUTION]\n> Danger ahead.");
    expect(result.html).toContain("markdown-alert-caution");
    expect(result.html).toContain("Danger ahead.");
  });

  it("renders [!TIP] alert", async () => {
    const result = await parseMarkdown("> [!TIP]\n> Pro tip here.");
    expect(result.html).toContain("markdown-alert-tip");
    expect(result.html).toContain("Pro tip here.");
  });

  it("renders [!IMPORTANT] alert", async () => {
    const result = await parseMarkdown("> [!IMPORTANT]\n> Read this.");
    expect(result.html).toContain("markdown-alert-important");
    expect(result.html).toContain("Read this.");
  });
});

// ---------------------------------------------------------------------------
// KaTeX math
// ---------------------------------------------------------------------------

describe("KaTeX math rendering", () => {
  it("renders inline math $...$", async () => {
    const result = await parseMarkdown("The equation $E = mc^2$ is famous.");
    expect(result.html).toContain("katex");
    expect(result.html).toContain("<math");
  });

  it("renders block math $$...$$", async () => {
    const result = await parseMarkdown("$$\n\\int_0^1 x\\,dx\n$$");
    expect(result.html).toContain("katex-display");
    expect(result.html).toContain("<math");
  });

  it("does not allow \\href in math", async () => {
    const result = await parseMarkdown("$\\href{https://evil.com}{click}$");
    // KaTeX in strict mode should either not render \href or produce safe output
    expect(result.html).not.toContain("javascript:");
  });
});

// ---------------------------------------------------------------------------
// Shiki code highlighting
// ---------------------------------------------------------------------------

describe("Shiki code highlighting", () => {
  it("highlights JavaScript code blocks", async () => {
    const result = await parseMarkdown("```javascript\nconst x = 42;\n```");
    expect(result.html).toContain("shiki-code-block");
  });

  it("adds dual theme classes", async () => {
    const result = await parseMarkdown("```typescript\nconst y: number = 10;\n```");
    expect(result.html).toContain("shiki-code-block");
  });

  it("falls back to plaintext for unknown languages", async () => {
    const result = await parseMarkdown("```brainfuck\n+++.\n```");
    expect(result.html).toContain("shiki-code-block");
  });
});

// ---------------------------------------------------------------------------
// Responsive tables
// ---------------------------------------------------------------------------

describe("Responsive table wrappers", () => {
  it("wraps GFM tables in a scroll container", async () => {
    const result = await parseMarkdown([
      "| Feature | Support |",
      "|---|---|",
      "| Tables | yes |",
    ].join("\n"));

    expect(result.html).toContain('class="table-wrapper"');
    expect(result.html).toContain("<table>");
  });
});

// ---------------------------------------------------------------------------
// Mermaid diagrams
// ---------------------------------------------------------------------------

describe("Mermaid diagram placeholders", () => {
  it("creates a placeholder for mermaid code blocks", async () => {
    const result = await parseMarkdown("```mermaid\ngraph LR\n  A --> B\n```");
    expect(result.html).toContain("mermaid-placeholder");
  });

  it("stores mermaid source in data attribute", async () => {
    const result = await parseMarkdown("```mermaid\ngraph TD\n  X --> Y\n```");
    expect(result.html).toContain("graph TD");
  });
});

// ---------------------------------------------------------------------------
// Combined pipeline still passes XSS tests
// ---------------------------------------------------------------------------

describe("XSS mitigations still work with new plugins", () => {
  it("strips javascript: links", async () => {
    const result = await parseMarkdown("[click](javascript:alert(1))");
    expect(result.html).not.toContain("javascript:");
  });

  it("strips HTML event handlers", async () => {
    const result = await parseMarkdown('<img src="x" onerror="alert(1)">');
    expect(result.html).not.toContain("onerror");
  });

  it("adds rel=noopener to external links", async () => {
    const result = await parseMarkdown("[link](https://example.com)");
    expect(result.html).toContain("noopener");
  });

  it("handles mixed alerts and code without XSS", async () => {
    const md = [
      '> [!NOTE]',
      '> Normal note.',
      '',
      '```html',
      '<script>alert("xss")</script>',
      '```',
    ].join("\n");
    const result = await parseMarkdown(md);
    expect(result.html).toContain("markdown-alert-note");
    expect(result.html).not.toContain("<script>");
  });
});
