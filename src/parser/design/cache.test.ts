import { beforeEach, describe, expect, it } from "vitest";
import { clearDesignPipelineCache, runDesignPipelineCached } from "./cache";

describe("runDesignPipelineCached", () => {
  beforeEach(() => {
    clearDesignPipelineCache();
  });

  it("returns the same DesignDocument object for cache hits", () => {
    const content = designFixture("Cache Hit", 4);

    const first = runDesignPipelineCached(content);
    const second = runDesignPipelineCached(content);

    expect(second).toBe(first);
  });

  it("runs the pipeline for cache misses", () => {
    const first = runDesignPipelineCached(designFixture("First", 2));
    const second = runDesignPipelineCached(designFixture("Second", 2));

    expect(second).not.toBe(first);
    expect(second.spec.colorTokens.length).toBeGreaterThan(0);
  });

  it("evicts the least recently used document after three entries", () => {
    const firstContent = designFixture("Design 0", 1);
    const first = runDesignPipelineCached(firstContent);

    for (let index = 1; index <= 3; index++) {
      runDesignPipelineCached(designFixture(`Design ${index}`, 1));
    }

    expect(runDesignPipelineCached(firstContent)).not.toBe(first);
  });

  it("handles a synthetic DESIGN.md with 1000 tokens", () => {
    const doc = runDesignPipelineCached(designFixture("Large Design", 1000));

    expect(doc.spec.colorTokens.length).toBeGreaterThan(900);
  });
});

function designFixture(name: string, tokenCount: number): string {
  const colors = Array.from({ length: tokenCount }, (_, index) => {
    const channel = (index % 255).toString(16).padStart(2, "0");
    return `  color-${index}: "#${channel}${channel}${channel}"`;
  }).join("\n");

  return `---
name: ${name}
colors:
${colors}
typography:
  body:
    fontFamily: "Inter"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
---

# ${name}
`;
}
