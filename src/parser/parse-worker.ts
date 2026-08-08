// src/parser/parse-worker.ts
//
// Web Worker that renders Markdown using the kmd-web rendering engine.
// Uses the kmd-web WorkerBridge protocol:
//   Receives: { id, source, options } (WorkerRenderRequest)
//   Responds: { type: "result", id, result } or { type: "error", id, error }
//
// The worker renders through `renderWithFeaturePlugins` from
// @axis-love/browser, NOT through core's bare `render()`. Rehype plugin
// functions are not structured-cloneable, so the optional feature packages
// (KaTeX math, Shiki highlighting) cannot be handed to the worker by the
// bridge — the worker has to inject them itself. `renderWithFeaturePlugins`
// is the same seam the main-thread path uses, so a document renders
// identically whether or not it crossed the worker size threshold.
//
// The helper is DOM-free at module scope and lazy-loads the feature packages,
// so it is safe to run in a Worker context.

import type { RenderOptions, RenderResult } from "@axis-love/contracts";
import { renderWithFeaturePlugins } from "@axis-love/browser";
import type { WorkerRenderRequest, WorkerRenderResponse } from "@axis-love/kmd-web";

self.onmessage = async (e: MessageEvent<WorkerRenderRequest>) => {
  const { id, source, options } = e.data;

  try {
    const result: RenderResult = await renderWithFeaturePlugins(
      source,
      options as RenderOptions | undefined,
    );
    const response: WorkerRenderResponse = { type: "result", id, result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerRenderResponse = {
      type: "error",
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
