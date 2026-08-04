// src/parser/parse-worker.ts
//
// Web Worker that renders Markdown using the kmd-web core render function.
// Uses the kmd-web WorkerBridge protocol:
//   Receives: { id, source, options } (WorkerRenderRequest)
//   Responds: { type: "result", id, result } or { type: "error", id, error }
//
// The worker imports render() from @axis-love/core which is DOM-free and
// safe to run in a Worker context.

import { render } from "@axis-love/core";
import type { RenderOptions, RenderResult } from "@axis-love/contracts";
import type { WorkerRenderRequest, WorkerRenderResponse } from "@axis-love/kmd-web";

self.onmessage = async (e: MessageEvent<WorkerRenderRequest>) => {
  const { id, source, options } = e.data;

  try {
    const result: RenderResult = await render(source, options as RenderOptions | undefined);
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