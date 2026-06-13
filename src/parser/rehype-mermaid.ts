import type { Plugin } from "unified";
import type { Element, Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";
import { extractText } from "./hast-utils";

const MERMAID_LANG_RE = /^language-mermaid$/i;
const RENDER_TIMEOUT_MS = 10_000;

let mermaidInitialized = false;
/**
 * Rehype plugin that detects `<code class="language-mermaid">` blocks and
 * replaces them with a placeholder `<div class="mermaid-placeholder">` that
 * carries the Mermaid source in a `data-mermaid-source` attribute.
 *
 * Actual rendering happens client-side in a React effect to keep the parse
 * pipeline synchronous-friendly and to allow lazy-loading mermaid.
 */
export const rehypeMermaid: Plugin<[], HastRoot, HastRoot> = function () {
  return (tree: HastRoot): HastRoot => {
    visit(tree, "element", (node: Element, _index, parent) => {
      if (
        node.tagName !== "code" ||
        !parent ||
        parent.type !== "element" ||
        parent.tagName !== "pre"
      )
        return;

      const classes = (node.properties?.className as string[]) ?? [];
      if (!classes.some((c) => MERMAID_LANG_RE.test(c))) return;

      const source = extractText(node);

      // Replace the <pre> with a mermaid placeholder by transforming in-place.
      // (parent is the <pre> element wrapping this <code> node.)
      (parent as Element).tagName = "div";
      (parent as Element).properties = {
        className: ["mermaid-placeholder"],
        dataMermaidSource: source,
      };
      (parent as Element).children = [
        {
          type: "element",
          tagName: "div",
          properties: { className: ["mermaid-render-target"] },
          children: [],
        },
      ];
    });

    return tree;
  };
};

/** Client-side Mermaid renderer — call from a React effect. */
export async function renderMermaidPlaceholders(container: HTMLElement): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLDivElement>(".mermaid-placeholder");
  if (placeholders.length === 0) return;

  const mermaid = await import("mermaid");

  if (!mermaidInitialized) {
    mermaid.default.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "default",
    });
    mermaidInitialized = true;
  }

  for (const placeholder of placeholders) {
    // Skip placeholders that already rendered so repeat passes (e.g. after
    // a DOM morph) do not flash existing diagrams.
    if (placeholder.dataset.mermaidRendered === "true") continue;
    placeholder.dataset.mermaidRendered = "true";

    const source = placeholder.dataset.mermaidSource ?? "";
    const target = placeholder.querySelector<HTMLDivElement>(".mermaid-render-target");
    if (!target || !source) continue;

    try {
      const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;

      const renderPromise = mermaid.default.render(id, source);
      const result = await Promise.race([
        renderPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Mermaid render timeout")), RENDER_TIMEOUT_MS)
        ),
      ]);

      target.innerHTML = result.svg;
    } catch (err) {
      target.innerHTML = `<pre class="mermaid-error"><code>${escapeHtml(
        source
      )}</code></pre><p class="mermaid-error-msg">Diagram rendering failed: ${escapeHtml(
        err instanceof Error ? err.message : String(err)
      )}</p>`;
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
