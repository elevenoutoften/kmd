import { describe, it, expect } from "vitest";
import { runDesignPipeline, type StageFn } from "./pipeline";

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe("runDesignPipeline", () => {
  it("returns empty DesignDocument for empty input", () => {
    const doc = runDesignPipeline("");

    expect(doc.spec.colors).toEqual({});
    expect(doc.spec.typography).toEqual({});
    expect(doc.spec.spacing).toEqual({});
    expect(doc.spec.radii).toEqual({});
    expect(doc.spec.layout).toEqual({});
    expect(doc.spec.raw).toEqual({});
    // Empty input triggers lint warnings: missing-primary, missing-typography
    expect(doc.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(doc.detection.score).toBe(0);
    expect(doc.detection.signals).toEqual([]);
    expect(doc.meta.sourceLength).toBe(0);
    expect(doc.meta.name).toBe("");
    expect(doc.meta.description).toBe("");
  });

  it("returns non-zero sourceLength for non-empty input", () => {
    const doc = runDesignPipeline("some content");
    expect(doc.meta.sourceLength).toBe("some content".length);
  });
});

// ---------------------------------------------------------------------------
// Stage order verification
// ---------------------------------------------------------------------------

describe("pipeline stage order", () => {
  it("executes stages in declared order", () => {
    const order: string[] = [];

    const stages: StageFn[] = [
      (doc) => { order.push("normalize"); void doc; },
      (doc) => { order.push("detect"); void doc; },
      (doc) => { order.push("extract"); void doc; },
      (doc) => { order.push("merge"); void doc; },
      (doc) => { order.push("resolve"); void doc; },
      (doc) => { order.push("enrich"); void doc; },
      (doc) => { order.push("validate"); void doc; },
      (doc) => { order.push("indexAndCache"); void doc; },
      (doc) => { order.push("render"); void doc; },
    ];

    runDesignPipeline("test", stages);

    expect(order).toEqual([
      "normalize",
      "detect",
      "extract",
      "merge",
      "resolve",
      "enrich",
      "validate",
      "indexAndCache",
      "render",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Error resilience
// ---------------------------------------------------------------------------

describe("pipeline error resilience", () => {
  it("continues when a stage throws", () => {
    const order: string[] = [];

    const stages: StageFn[] = [
      (doc) => { order.push("a"); void doc; },
      (_doc) => { throw new Error("boom"); },
      (doc) => { order.push("c"); void doc; },
    ];

    const doc = runDesignPipeline("test", stages);

    // Stages a and c both ran.
    expect(order).toEqual(["a", "c"]);

    // The error was captured as a diagnostic.
    expect(doc.diagnostics).toHaveLength(1);
    expect(doc.diagnostics[0]!.severity).toBe("error");
    expect(doc.diagnostics[0]!.message).toContain("boom");
  });

  it("captures multiple stage errors", () => {
    const stages: StageFn[] = [
      (_doc) => { throw new Error("err1"); },
      (_doc) => { throw new Error("err2"); },
    ];

    const doc = runDesignPipeline("test", stages);

    expect(doc.diagnostics).toHaveLength(2);
    expect(doc.diagnostics[0]!.message).toContain("err1");
    expect(doc.diagnostics[1]!.message).toContain("err2");
  });

  it("captures non-Error throws as string diagnostics", () => {
    const stages: StageFn[] = [
      (_doc) => { throw "string error"; }, // eslint-disable-line no-throw-literal
    ];

    const doc = runDesignPipeline("test", stages);

    expect(doc.diagnostics).toHaveLength(1);
    expect(doc.diagnostics[0]!.message).toContain("string error");
  });
});

// ---------------------------------------------------------------------------
// Mutation propagation
// ---------------------------------------------------------------------------

describe("stage mutation", () => {
  it("stages can mutate the DesignDocument", () => {
    const stages: StageFn[] = [
      (doc) => {
        doc.spec.colors["primary"] = "#000000";
        doc.meta.name = "test";
        doc.detection.score = 0.5;
        doc.detection.signals.push("yaml-front-matter");
      },
    ];

    const doc = runDesignPipeline("test", stages);

    expect(doc.spec.colors["primary"]).toBe("#000000");
    expect(doc.meta.name).toBe("test");
    expect(doc.detection.score).toBe(0.5);
    expect(doc.detection.signals).toContain("yaml-front-matter");
  });
});
