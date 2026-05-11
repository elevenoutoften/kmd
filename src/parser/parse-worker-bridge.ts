import type { ParseResult } from "./index";
import { getCachedParseResult, setCachedParseResult } from "./parse-cache";

interface PendingRequest {
  resolve: (result: ParseResult) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
const pending = new Map<number, PendingRequest>();
let nextId = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("./parse-worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.addEventListener("message", handleWorkerMessage);
    worker.addEventListener("error", handleWorkerError);
  }
  return worker;
}

function handleWorkerMessage(e: MessageEvent): void {
  const { id, type } = e.data;
  const pending_request = pending.get(id);
  if (!pending_request) return;
  pending.delete(id);

  if (type === "result") {
    pending_request.resolve(e.data.result as ParseResult);
  } else {
    pending_request.reject(new Error(e.data.error as string));
  }
}

function handleWorkerError(e: ErrorEvent): void {
  for (const [id, req] of pending) {
    req.reject(new Error(`Worker error: ${e.message}`));
    pending.delete(id);
  }
  if (worker) {
    worker.removeEventListener("message", handleWorkerMessage);
    worker.removeEventListener("error", handleWorkerError);
    worker.terminate();
    worker = null;
  }
}

export function parseMarkdownInWorker(content: string): Promise<ParseResult> {
  const cached = getCachedParseResult(content);
  if (cached) return Promise.resolve(cached);

  const id = ++nextId;
  const w = getWorker();

  return new Promise<ParseResult>((resolve, reject) => {
    pending.set(id, {
      resolve: (result: ParseResult) => {
        setCachedParseResult(content, result);
        resolve(result);
      },
      reject,
    });
    w.postMessage({ type: "parse", content, id });
  });
}

export function terminateParseWorker(): void {
  if (worker) {
    for (const [, req] of pending) {
      req.reject(new Error("Worker terminated"));
    }
    pending.clear();
    worker.removeEventListener("message", handleWorkerMessage);
    worker.removeEventListener("error", handleWorkerError);
    worker.terminate();
    worker = null;
  }
}
