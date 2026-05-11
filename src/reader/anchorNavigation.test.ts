import { describe, expect, it } from "vitest";
import { findAnchorTarget, getReaderScrollTopForTarget } from "./anchorNavigation";

describe("reader anchor navigation", () => {
  it("computes scrollTop relative to the reader scroll container", () => {
    expect(getReaderScrollTopForTarget(200, 48, 348)).toBe(488);
  });

  it("does not scroll before the top of the reader", () => {
    expect(getReaderScrollTopForTarget(0, 48, 20)).toBe(0);
  });

  it("finds sanitizer-prefixed heading and footnote targets", () => {
    const heading = { id: "user-content-heading", getAttribute: () => null } as unknown as HTMLElement;
    const footnote = { id: "user-content-user-content-fn-1", getAttribute: () => null } as unknown as HTMLElement;
    const root = {
      querySelectorAll: () => [heading, footnote],
    } as unknown as ParentNode;

    expect(findAnchorTarget(root, "heading")).toBe(heading);
    expect(findAnchorTarget(root, "user-content-fn-1")).toBe(footnote);
  });
});
