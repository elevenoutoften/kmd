let loaded = false;

export function ensureKatexCss(): void {
  if (loaded) return;
  loaded = true;
  import("katex/dist/katex.min.css");
}
