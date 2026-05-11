import { parseMarkdown } from "./index";

interface WorkerRequest {
  type: "parse";
  content: string;
  id: number;
}

interface WorkerSuccess {
  type: "result";
  id: number;
  result: { html: string; outline: Array<{ text: string; level: number; id: string }>; hasMath: boolean };
}

interface WorkerError {
  type: "error";
  id: number;
  error: string;
}

type WorkerResponse = WorkerSuccess | WorkerError;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { type, content, id } = e.data;
  if (type !== "parse") return;

  try {
    const result = await parseMarkdown(content);
    const response: WorkerResponse = { type: "result", id, result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      type: "error",
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
