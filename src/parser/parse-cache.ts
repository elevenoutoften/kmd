import type { ParseResult } from "./index";

const MAX_CACHE_SIZE = 8;
const cache = new Map<string, ParseResult>();

export function getCachedParseResult(content: string): ParseResult | undefined {
  const key = hashContent(content);
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
  }
  return cached;
}

export function setCachedParseResult(content: string, result: ParseResult): void {
  const key = hashContent(content);
  cache.set(key, result);
  if (cache.size > MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

export function evictCachedParseResult(content: string): void {
  const key = hashContent(content);
  cache.delete(key);
}

export function clearParseCache(): void {
  cache.clear();
}

function hashContent(content: string): string {
  let hash = 5381;
  for (let index = 0; index < content.length; index++) {
    hash = ((hash << 5) + hash + content.charCodeAt(index)) >>> 0;
  }
  return `${content.length}:${hash.toString(16)}`;
}
