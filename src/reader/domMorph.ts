/**
 * Minimal block-level DOM morphing for the two-phase Markdown render.
 *
 * The reader first paints a quick parse (no syntax highlighting), then a
 * worker delivers the full parse. Replacing the whole body with
 * `innerHTML` made every image re-decode and the entire document flash.
 * Instead, this swaps only the top-level blocks that actually changed
 * (typically code blocks gaining highlighting), leaving text, images, and
 * already-rendered content untouched.
 */

/** Attribute where the original Markdown `src` is kept once an image has
 * been resolved to an inline data URL. */
export const RAW_IMAGE_SRC_ATTR = "data-kmd-raw-src";

const COPY_TITLE = "Click to copy";

/**
 * Clone a live block and undo the in-place enhancements (resolved image
 * sources, copy-hint titles) so it can be compared against freshly parsed
 * HTML for the same Markdown.
 */
function normalizedClone(node: Element): Element {
  const clone = node.cloneNode(true) as Element;

  const images = clone.querySelectorAll(`img[${RAW_IMAGE_SRC_ATTR}]`);
  for (const img of images) {
    const rawSrc = img.getAttribute(RAW_IMAGE_SRC_ATTR);
    if (rawSrc !== null) {
      img.setAttribute("src", rawSrc);
    }
    img.removeAttribute(RAW_IMAGE_SRC_ATTR);
  }

  const titled = clone.querySelectorAll("code[title], code span[title]");
  for (const el of titled) {
    if (el.getAttribute("title") === COPY_TITLE) {
      el.removeAttribute("title");
    }
  }

  return clone;
}

function nodesEquivalent(liveNode: Node, nextNode: Node): boolean {
  if (liveNode.isEqualNode(nextNode)) return true;
  if (liveNode.nodeType !== Node.ELEMENT_NODE || nextNode.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  return normalizedClone(liveNode as Element).isEqualNode(nextNode);
}

/**
 * Update `container` children in place to match `nextHtml`, replacing only
 * the blocks that differ. Returns `true` when anything changed.
 */
export function morphMarkdownBody(container: HTMLElement, nextHtml: string): boolean {
  const template = container.ownerDocument.createElement("template");
  template.innerHTML = nextHtml;

  const liveNodes = Array.from(container.childNodes);
  const nextNodes = Array.from(template.content.childNodes);
  let changed = false;

  const max = Math.max(liveNodes.length, nextNodes.length);
  for (let index = 0; index < max; index++) {
    const liveNode = liveNodes[index];
    const nextNode = nextNodes[index];

    if (liveNode === undefined && nextNode !== undefined) {
      container.appendChild(nextNode);
      changed = true;
      continue;
    }

    if (liveNode !== undefined && nextNode === undefined) {
      container.removeChild(liveNode);
      changed = true;
      continue;
    }

    if (liveNode === undefined || nextNode === undefined) continue;

    if (!nodesEquivalent(liveNode, nextNode)) {
      container.replaceChild(nextNode, liveNode);
      changed = true;
    }
  }

  return changed;
}
