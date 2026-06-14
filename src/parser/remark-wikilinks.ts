import type { Link, Parent, PhrasingContent, Root, Text } from "mdast";
import { SKIP, visit } from "unist-util-visit";

const WIKILINK_RE = /\[\[([^\]\n]+?)\]\]/g;

function splitWikilink(value: string): { target: string; label: string } | null {
  const pipeIndex = value.indexOf("|");
  const rawTarget = pipeIndex === -1 ? value : value.slice(0, pipeIndex);
  const rawLabel = pipeIndex === -1 ? value : value.slice(pipeIndex + 1);
  const target = rawTarget.trim();

  if (!target) {
    return null;
  }

  const label = rawLabel.trim() || target;
  return { target, label };
}

function wikilinkNode(target: string, label: string): Link {
  return {
    type: "link",
    url: target,
    title: null,
    children: [{ type: "text", value: label }],
  };
}

function splitTextNode(value: string): PhrasingContent[] | null {
  const nodes: PhrasingContent[] = [];
  let lastIndex = 0;
  let hasWikilink = false;

  WIKILINK_RE.lastIndex = 0;

  for (const match of value.matchAll(WIKILINK_RE)) {
    const fullMatch = match[0];
    const rawInner = match[1];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      nodes.push({ type: "text", value: value.slice(lastIndex, index) });
    }

    const parsed = rawInner ? splitWikilink(rawInner) : null;
    if (parsed) {
      nodes.push(wikilinkNode(parsed.target, parsed.label));
      hasWikilink = true;
    } else {
      nodes.push({ type: "text", value: fullMatch });
    }

    lastIndex = index + fullMatch.length;
  }

  if (!hasWikilink) {
    return null;
  }

  if (lastIndex < value.length) {
    nodes.push({ type: "text", value: value.slice(lastIndex) });
  }

  return nodes;
}

function replaceTextChild(parent: Parent, index: number, node: Text): number | void {
  const replacement = splitTextNode(node.value);
  if (!replacement) {
    return undefined;
  }

  parent.children.splice(index, 1, ...replacement);
  return index + replacement.length;
}

export function remarkWikilinks() {
  return (tree: Root): Root => {
    visit(tree, (node, index, parent) => {
      if (node.type === "link" || node.type === "linkReference") {
        return SKIP;
      }

      if (node.type !== "text" || typeof index !== "number" || !parent) {
        return undefined;
      }

      return replaceTextChild(parent, index, node as Text);
    });

    return tree;
  };
}
