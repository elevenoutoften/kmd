import { beforeEach, describe, expect, it } from "vitest";
import { getCachedParseResult, setCachedParseResult, clearParseCache, evictCachedParseResult } from "./parse-cache";

describe("parse-cache", () => {
  beforeEach(() => {
    clearParseCache();
  });

  it("returns undefined for cache misses", () => {
    expect(getCachedParseResult("hello")).toBeUndefined();
  });

  it("returns cached result for cache hits", () => {
    const result = { html: "<p>hello</p>", outline: [], hasMath: false };
    setCachedParseResult("hello", result);
    expect(getCachedParseResult("hello")).toBe(result);
  });

  it("returns the same object reference for cache hits", () => {
    const result = { html: "<p>hello</p>", outline: [], hasMath: false };
    setCachedParseResult("hello", result);
    expect(getCachedParseResult("hello")).toBe(result);
  });

  it("evicts the least recently used entry after 8 entries", () => {
    const first = { html: "<p>first</p>", outline: [], hasMath: false };
    setCachedParseResult("first", first);

    for (let i = 1; i <= 8; i++) {
      setCachedParseResult(`entry-${i}`, {
        html: `<p>entry ${i}</p>`,
        outline: [],
        hasMath: false,
      });
    }

    expect(getCachedParseResult("first")).toBeUndefined();
  });

  it("promotes accessed entries to most-recent", () => {
    const first = { html: "<p>first</p>", outline: [], hasMath: false };
    setCachedParseResult("first", first);

    for (let i = 1; i <= 7; i++) {
      setCachedParseResult(`entry-${i}`, {
        html: `<p>entry ${i}</p>`,
        outline: [],
        hasMath: false,
      });
    }

    getCachedParseResult("first");

    setCachedParseResult("entry-8", {
      html: "<p>entry 8</p>",
      outline: [],
      hasMath: false,
    });

    expect(getCachedParseResult("first")).toBe(first);
  });

  it("overwrites existing entries", () => {
    const original = { html: "<p>original</p>", outline: [], hasMath: false };
    const updated = { html: "<p>updated</p>", outline: [], hasMath: false };

    setCachedParseResult("key", original);
    setCachedParseResult("key", updated);

    expect(getCachedParseResult("key")).toBe(updated);
  });

  it("clearParseCache removes all entries", () => {
    setCachedParseResult("a", { html: "a", outline: [], hasMath: false });
    setCachedParseResult("b", { html: "b", outline: [], hasMath: false });
    clearParseCache();
    expect(getCachedParseResult("a")).toBeUndefined();
    expect(getCachedParseResult("b")).toBeUndefined();
  });

  it("evictCachedParseResult removes a specific entry", () => {
    setCachedParseResult("target", { html: "target", outline: [], hasMath: false });
    setCachedParseResult("keep", { html: "keep", outline: [], hasMath: false });
    evictCachedParseResult("target");
    expect(getCachedParseResult("target")).toBeUndefined();
    expect(getCachedParseResult("keep")).not.toBeUndefined();
  });

  it("evictCachedParseResult is a no-op for missing keys", () => {
    setCachedParseResult("a", { html: "a", outline: [], hasMath: false });
    evictCachedParseResult("nonexistent");
    expect(getCachedParseResult("a")).not.toBeUndefined();
  });
});
