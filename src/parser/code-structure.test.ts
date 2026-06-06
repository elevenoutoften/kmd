import { describe, it, expect } from "vitest";
import { parseMarkdown } from "./index";

describe("Code block HTML structure", () => {
  it("does not create nested pre elements", async () => {
    const result = await parseMarkdown("```javascript\nconst x = 42;\n```");
    
    // Count opening pre tags
    const preOpenMatches = result.html.match(/<pre[\s>]/g) ?? [];
    const preOpenCount = preOpenMatches.length;
    
    // Should have exactly one <pre> element per code block
    expect(preOpenCount).toBe(1);
    
    // Should have shiki-code-block class
    expect(result.html).toContain('class="shiki-code-block"');
    
    // Should have code element inside
    expect(result.html).toContain("<code>");
    expect(result.html).toContain("</code>");
    
    // Log the HTML for debugging
    console.log("Generated HTML:", result.html);
  });

  it("has spans with style attributes for syntax highlighting", async () => {
    const result = await parseMarkdown("```typescript\nconst y: number = 10;\n```");
    
    // Should have span elements with style attributes
    expect(result.html).toMatch(/<span[^>]*style=/);
  });

  it("preserves code content correctly", async () => {
    const code = "function hello() {\n  console.log('world');\n}";
    const md = "```javascript\n" + code + "\n```";
    const result = await parseMarkdown(md);
    
    // Should contain the code text (without HTML entities for basic chars)
    expect(result.html).toContain("function");
    expect(result.html).toContain("hello");
    expect(result.html).toContain("console");
  });
});
