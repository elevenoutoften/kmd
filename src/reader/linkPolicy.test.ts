import { describe, expect, it } from "vitest";
import { classifyRenderedLink, getFragmentIdFromHref, normalizeExternalHref } from "./linkPolicy";

describe("rendered link click policy", () => {
  it.each(["", "#", "/docs/readme.md", "./other.md", "../parent.md", "docs/guide.md"])(
    "keeps %j inside the reader",
    (href) => {
      expect(classifyRenderedLink(href)).toBe("internal");
    },
  );

  it.each(["#intro", "#user-content-fn-1", "#heading%20with%20space"])(
    "scrolls %j inside the reader pane",
    (href) => {
      expect(classifyRenderedLink(href)).toBe("fragment");
    },
  );

  it.each(["https://example.com", "http://example.com", "mailto:user@example.com", "tel:+1234567890", "//example.com"])(
    "opens %j externally",
    (href) => {
      expect(classifyRenderedLink(href)).toBe("external");
    },
  );

  it.each(["javascript:alert(1)", "vbscript:MsgBox(1)", "file:///etc/passwd", "data:text/html,<script></script>", "custom://link"])(
    "blocks %j if it reaches the click handler",
    (href) => {
      expect(classifyRenderedLink(href)).toBe("blocked");
    },
  );

  it("normalizes protocol-relative URLs to https before opening externally", () => {
    expect(normalizeExternalHref("//example.com/path")).toBe("https://example.com/path");
  });

  it("extracts and decodes fragment ids", () => {
    expect(getFragmentIdFromHref("#heading%20with%20space")).toBe("heading with space");
    expect(getFragmentIdFromHref("#user-content-fn-1")).toBe("user-content-fn-1");
    expect(getFragmentIdFromHref("docs/guide.md#section")).toBeNull();
  });
});
