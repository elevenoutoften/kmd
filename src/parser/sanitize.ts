import type { Plugin } from "unified";
import type { Element, Root as HastRoot, Properties } from "hast";
import { visit } from "unist-util-visit";
import { defaultSchema, type Schema } from "hast-util-sanitize";

// ---------------------------------------------------------------------------
// Custom sanitize schema (extends rehype-sanitize defaults)
// ---------------------------------------------------------------------------

type Attributes = NonNullable<Schema["attributes"]>;

const defaultAttributes = defaultSchema.attributes as Attributes;

/**
 * Extended sanitize schema that permits `rel` and `target` on `<a>` elements
 * so that the URL policy plugin can add noopener/noreferrer after sanitization.
 *
 * Also allows safe inline HTML tags from the security policy (kbd, mark, etc.)
 * and elements/attributes needed by:
 *   - GitHub alerts (div with class)
 *   - KaTeX math (MathML elements, span with class/style)
 *   - Shiki code highlighting (span with style)
 *   - Mermaid SVG output (svg and children)
 */
export const sanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames as string[]),
    // Safe inline HTML tags from security policy
    "kbd", "mark", "sub", "sup", "abbr", "details", "summary",
    // GitHub alerts: div wrappers with class
    "div",
    // KaTeX MathML elements
    "math", "semantics", "mrow", "mi", "mo", "mn", "msup", "msubsup",
    "annotation", "mop", "mtext", "mfrac", "msqrt", "mroot", "mfenced",
    "mtable", "mtr", "mtd", "munderover", "munder", "mover", "mpadded",
    "mspace", "menclose", "mglyph", "mlabeledtr", "mmultiscripts",
    "msub", "msup", "munderover",
    // SVG for Mermaid/inline diagrams
    "svg", "path", "circle", "rect", "line", "polyline", "polygon",
    "ellipse", "g", "text", "tspan", "defs", "clippath", "use",
    "title", "desc", "foreignObject", "marker",
  ],
  attributes: {
    ...defaultSchema.attributes,
    // Links: allow rel and target for URL policy
    a: [...(defaultAttributes.a ?? []), "rel", "target"],
    // Allow class on most elements (alerts, KaTeX, Shiki)
    div: [...(defaultAttributes.div ?? []), "className", "dataMermaidSource"],
    p: [...(defaultAttributes.p ?? []), "className"],
    span: [...(defaultAttributes.span ?? []), "className", "style"],
    pre: [...(defaultAttributes.pre ?? []), "className", "dataLanguage", "tabindex", "style"],
    code: [...(defaultAttributes.code ?? []), "className"],
    // Preserve the default safe attributes, including clobber-protected id/name.
    "*": [...(defaultAttributes["*"] ?? []), "className"],
    // MathML elements need various attributes
    math: ["xmlns", "display"],
    annotation: ["encoding"],
    svg: ["xmlns", "viewBox", "width", "height", "style", "aria-hidden", "role", "aria-label", "aria-labelledby"],
    path: ["d", "fill", "stroke", "strokeWidth", "transform", "id", "style"],
    g: ["transform", "fill", "stroke", "id", "style", "clip-path"],
    text: ["x", "y", "dx", "dy", "textAnchor", "fontSize", "fontFamily", "fill", "style"],
    tspan: ["x", "y", "dx", "dy", "textAnchor", "fontSize", "style"],
    rect: ["x", "y", "width", "height", "rx", "ry", "fill", "stroke", "style"],
    circle: ["cx", "cy", "r", "fill", "stroke", "style"],
    line: ["x1", "y1", "x2", "y2", "stroke", "strokeWidth", "style"],
    polyline: ["points", "fill", "stroke", "style"],
    polygon: ["points", "fill", "stroke", "style"],
    ellipse: ["cx", "cy", "rx", "ry", "fill", "stroke", "style"],
    use: ["href", "xlinkHref", "x", "y", "width", "height"],
    clippath: ["id"],
    marker: ["id", "viewBox", "refX", "refY", "markerWidth", "markerHeight", "orient"],
    foreignObject: ["x", "y", "width", "height"],
    defs: [],
    title: [],
    desc: [],
  },
};

// ---------------------------------------------------------------------------
// URL scheme policy
// ---------------------------------------------------------------------------

const ALLOWED_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/**
 * Determine whether a URL string is safe to include in rendered output.
 *
 * Safe means: the scheme (if present) is in the explicit allow-list, or the
 * value is a relative/fragment-only reference with no scheme at all.
 *
 * Blocked by default: javascript:, vbscript:, data:, file:, and any
 * custom/unknown scheme.
 */
export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();

  // Fragment-only and empty refs are fine.
  if (trimmed === "" || trimmed.startsWith("#")) return true;

  // Relative paths (./ ../ or bare path segments) are fine.
  if (/^[./]/.test(trimmed) || !/:/.test(trimmed)) return true;

  // Extract scheme (everything before the first colon).
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx === -1) return true; // no scheme → relative

  const scheme = trimmed.slice(0, colonIdx).toLowerCase();
  return ALLOWED_SCHEMES.has(scheme);
}

// ---------------------------------------------------------------------------
// Event-handler attribute detection
// ---------------------------------------------------------------------------

const EVENT_ATTR_RE = /^on/i;

function isEventHandler(attrName: string): boolean {
  return EVENT_ATTR_RE.test(attrName);
}

// ---------------------------------------------------------------------------
// rehype plugin: URL policy
// ---------------------------------------------------------------------------

// Elements whose href attributes should be checked.
const LINK_ELEMENTS = new Set(["a"]);
// Elements with src or other URL attributes.
const SRC_ELEMENTS = new Set(["img", "video", "audio", "source", "track", "embed", "iframe"]);

/**
 * Rehype plugin that enforces the URL policy and strips dangerous attributes.
 *
 * Walks the hast tree and:
 *  - Removes href/src attributes that carry unsafe URLs.
 *  - Adds rel="noopener noreferrer" to external links.
 *  - Strips event-handler attributes (onclick, onerror, etc.).
 */
export const rehypeUrlPolicy: Plugin<[], HastRoot, HastRoot> = function () {
  return (tree: HastRoot): HastRoot => {
    visit(tree, "element", (node: Element) => {
      if (!node.properties) return;

      const props = node.properties as Properties;
      const tag = node.tagName;

      // --- Strip event-handler attributes ---
      for (const attr of Object.keys(props)) {
        if (isEventHandler(attr)) {
          delete props[attr];
        }
      }

      // --- Check href on links ---
      if (LINK_ELEMENTS.has(tag) && typeof props.href === "string") {
        if (!isSafeUrl(props.href)) {
          delete props.href;
        } else if (isExternalUrl(props.href)) {
          // Add rel attributes for external links.
          const existing = typeof props.rel === "string" ? props.rel : "";
          const tokens = new Set(existing.split(/\s+/).filter(Boolean));
          tokens.add("noopener");
          tokens.add("noreferrer");
          props.rel = [...tokens].join(" ");
          // Prevent opener leakage.
          if (props.target === undefined) {
            props.target = "_blank";
          }
        }
      }

      // --- Check src on media/embed elements ---
      if (SRC_ELEMENTS.has(tag)) {
        for (const urlAttr of ["src", "srcset", "data", "poster"] as const) {
          const val = props[urlAttr];
          if (typeof val === "string" && !isSafeUrl(val)) {
            delete props[urlAttr];
          }
        }
      }
    });

    return tree;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Best-effort external-URL detection. A URL is considered external if it has
 * an allowed scheme that is not mailto: or tel:.
 */
function isExternalUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return false;
  }
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx === -1) return false; // relative
  const scheme = trimmed.slice(0, colonIdx).toLowerCase();
  if (scheme === "mailto" || scheme === "tel") return false;
  return ALLOWED_SCHEMES.has(scheme);
}
