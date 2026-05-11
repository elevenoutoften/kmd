import { describe, it, expect } from "vitest";
import { isSafeUrl } from "./sanitize";
import { parseMarkdown } from "./index";

// ---------------------------------------------------------------------------
// isSafeUrl
// ---------------------------------------------------------------------------

describe("isSafeUrl", () => {
  // --- Safe URLs ---
  describe("safe URLs", () => {
    it("allows https:", () => {
      expect(isSafeUrl("https://example.com")).toBe(true);
    });

    it("allows http:", () => {
      expect(isSafeUrl("http://example.com")).toBe(true);
    });

    it("allows mailto:", () => {
      expect(isSafeUrl("mailto:user@example.com")).toBe(true);
    });

    it("allows tel:", () => {
      expect(isSafeUrl("tel:+1234567890")).toBe(true);
    });

    it("allows relative paths", () => {
      expect(isSafeUrl("./other.md")).toBe(true);
      expect(isSafeUrl("../parent.md")).toBe(true);
    });

    it("allows fragment-only links", () => {
      expect(isSafeUrl("#section")).toBe(true);
    });

    it("allows bare paths without scheme", () => {
      expect(isSafeUrl("docs/guide.md")).toBe(true);
    });

    it("allows empty string", () => {
      expect(isSafeUrl("")).toBe(true);
    });
  });

  // --- Unsafe URLs ---
  describe("unsafe URLs", () => {
    it("blocks javascript:", () => {
      expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    });

    it("blocks javascript: with mixed case", () => {
      expect(isSafeUrl("JaVaScRiPt:alert(1)")).toBe(false);
    });

    it("blocks vbscript:", () => {
      expect(isSafeUrl("vbscript:MsgBox('xss')")).toBe(false);
    });

    it("blocks data: text/html", () => {
      expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    });

    it("blocks data: image/svg+xml", () => {
      expect(isSafeUrl("data:image/svg+xml,<svg onload=alert(1)>")).toBe(false);
    });

    it("blocks file:", () => {
      expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    });

    it("blocks custom schemes", () => {
      expect(isSafeUrl("myapp://deep-link")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Pipeline integration — XSS fixtures
// ---------------------------------------------------------------------------

describe("parseMarkdown XSS mitigation", () => {
  it("strips javascript: links from output", async () => {
    const result = await parseMarkdown("[click](javascript:alert(1))");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("alert(1)");
  });

  it("strips data: URIs from output", async () => {
    const result = await parseMarkdown("[link](data:text/html,<script>alert(1)</script>)");
    expect(result.html).not.toContain("data:text/html");
  });

  it("strips vbscript: links from output", async () => {
    const result = await parseMarkdown("[link](vbscript:MsgBox('xss'))");
    expect(result.html).not.toContain("vbscript:");
  });

  it("strips file: links from output", async () => {
    const result = await parseMarkdown("[link](file:///etc/passwd)");
    expect(result.html).not.toContain("file://");
  });

  it("strips HTML event handlers", async () => {
    const result = await parseMarkdown('<img src="x" onerror="alert(1)">');
    // rehype-sanitize will strip the img entirely or strip onerror;
    // either way, onerror must not survive.
    expect(result.html).not.toContain("onerror");
  });

  it("adds rel=noopener to external links", async () => {
    const result = await parseMarkdown("[link](https://example.com)");
    expect(result.html).toContain("noopener");
    expect(result.html).toContain("noreferrer");
  });

  it("preserves safe https links", async () => {
    const result = await parseMarkdown("[link](https://example.com)");
    expect(result.html).toContain("https://example.com");
  });

  it("preserves mailto links", async () => {
    const result = await parseMarkdown("[email](mailto:user@example.com)");
    expect(result.html).toContain("mailto:user@example.com");
  });

  it("preserves relative links", async () => {
    const result = await parseMarkdown("[doc](./other.md)");
    expect(result.html).toContain("./other.md");
  });

  it("preserves fragment links", async () => {
    const result = await parseMarkdown("[section](#heading)");
    expect(result.html).toContain("#heading");
  });

  it("preserves clobber-safe heading ids for outline navigation", async () => {
    const result = await parseMarkdown("## Heading");

    expect(result.html).toContain('id="user-content-heading"');
    expect(result.outline).toEqual([{ text: "Heading", level: 2, id: "user-content-heading" }]);
  });

  it("preserves clobber-safe footnote ids for document fragment links", async () => {
    const result = await parseMarkdown("Footnote[^1]\n\n[^1]: note");

    expect(result.html).toContain('href="#user-content-fn-1"');
    expect(result.html).toContain('id="user-content-user-content-fn-1"');
    expect(result.html).toContain('id="user-content-user-content-fnref-1"');
  });
});
