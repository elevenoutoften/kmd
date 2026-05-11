import type { DesignDocument } from "./ir";
import { runDesignPipeline } from "./pipeline";

const MAX_CACHE_SIZE = 3;
const cache = new Map<string, DesignDocument>();

export function runDesignPipelineCached(content: string): DesignDocument {
  const key = hashContent(content);
  const cached = cache.get(key);

  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  const doc = runDesignPipeline(content);
  cache.set(key, doc);

  if (cache.size > MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }

  return doc;
}

export function clearDesignPipelineCache(): void {
  cache.clear();
}

function hashContent(content: string): string {
  let hash = 5381;

  for (let index = 0; index < content.length; index++) {
    hash = ((hash << 5) + hash + content.charCodeAt(index)) >>> 0;
  }

  return `${content.length}:${hash.toString(16)}`;
}
