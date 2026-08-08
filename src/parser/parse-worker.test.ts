// @vitest-environment node
//
// Worker entry tests (KWEB-039).
//
// Documents at or above kmd-web's 4096-char threshold render in this worker
// rather than on the main thread. Rehype plugin functions cannot be posted to
// a worker, so the entry has to inject the feature packages itself — these
// tests pin that a large document comes back with Shiki-highlighted code and
// KaTeX-rendered math, not plain code and raw `$$` placeholders.

import type { WorkerRenderRequest, WorkerRenderResponse } from "@axis-love/kmd-web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fixture — large enough to route through the worker
// ---------------------------------------------------------------------------

const FILLER = Array.from(
  { length: 40 },
  (_, i) => `Paragraph ${i} — ${"the quick brown fox jumps over the lazy dog. ".repeat(3)}`,
).join("\n\n");

const LARGE_DOC = [
  "# Worker path",
  "",
  "```ts",
  "const answer: number = 42;",
  "```",
  "",
  "Inline $E = mc^2$ math.",
  "",
  "$$",
  "\\frac{1}{2}",
  "$$",
  "",
  FILLER,
].join("\n");

/** kmd-web's WorkerBridge main-thread threshold. */
const MAIN_THREAD_THRESHOLD = 4096;

// ---------------------------------------------------------------------------
// Worker harness — stands in for the WorkerBridge on the other side
// ---------------------------------------------------------------------------

interface WorkerGlobal {
  onmessage: ((e: MessageEvent<WorkerRenderRequest>) => void) | null;
  postMessage: (message: WorkerRenderResponse) => void;
}

let workerSelf: WorkerGlobal;
let responses: WorkerRenderResponse[];
let originalSelf: PropertyDescriptor | undefined;

/** Post a request into the worker and wait for its response. */
async function renderInWorker(source: string): Promise<WorkerRenderResponse> {
  workerSelf.onmessage?.({ data: { id: 1, source } } as MessageEvent<WorkerRenderRequest>);
  // The entry awaits dynamic imports of the feature packages before it renders.
  for (let tick = 0; tick < 500 && responses.length === 0; tick++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const response = responses[0];
  if (!response) throw new Error("worker did not respond");
  return response;
}

function expectResult(response: WorkerRenderResponse): string {
  expect(response.type).toBe("result");
  if (response.type !== "result") throw new Error(response.error);
  expect(response.id).toBe(1);
  return response.result.html;
}

describe("parse-worker", () => {
  beforeEach(async () => {
    responses = [];
    workerSelf = {
      onmessage: null,
      postMessage: (message) => {
        responses.push(message);
      },
    };

    originalSelf = Object.getOwnPropertyDescriptor(globalThis, "self");
    Object.defineProperty(globalThis, "self", {
      value: workerSelf,
      configurable: true,
      writable: true,
    });

    // Import fresh so the entry installs its handler on the stubbed `self`.
    vi.resetModules();
    await import("./parse-worker");
  });

  afterEach(() => {
    if (originalSelf) {
      Object.defineProperty(globalThis, "self", originalSelf);
    } else {
      Reflect.deleteProperty(globalThis, "self");
    }
  });

  it("uses a fixture large enough to reach the worker", () => {
    expect(LARGE_DOC.length).toBeGreaterThan(MAIN_THREAD_THRESHOLD);
  });

  it("installs a message handler", () => {
    expect(workerSelf.onmessage).toBeTypeOf("function");
  });

  it("highlights code blocks with Shiki", async () => {
    const html = expectResult(await renderInWorker(LARGE_DOC));
    expect(html).toContain("shiki-code-block");
    expect(html).toContain("shiki-token");
  });

  it("surfaces the generated highlight stylesheet on the result", async () => {
    const response = await renderInWorker(LARGE_DOC);
    expect(response.type).toBe("result");
    if (response.type !== "result") return;
    expect(response.result.codeHighlightCss ?? "").toMatch(/\.shiki-c[a-z0-9]+\{color:/);
  });

  it("renders math with KaTeX", async () => {
    const html = expectResult(await renderInWorker(LARGE_DOC));
    expect(html).toContain("katex");
    expect(html).toContain("<math");
    expect(html).not.toContain("language-math");
  });

  it("posts an error response when rendering fails", async () => {
    // maxSourceSize is enforced by core — an oversized source throws.
    workerSelf.onmessage?.({
      data: { id: 1, source: "x".repeat(64), options: { maxSourceSize: 8 } },
    } as MessageEvent<WorkerRenderRequest>);
    for (let tick = 0; tick < 200 && responses.length === 0; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(responses[0]?.type).toBe("error");
  });
});
