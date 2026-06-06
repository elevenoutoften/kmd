import type { Plugin } from "unified";
import type { Element, Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";

export const rehypeCopyButton: Plugin<[], HastRoot, HastRoot> = function () {
  return (tree: HastRoot): HastRoot => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;

      // Check if this is a code block (has <code> child or is a shiki block)
      const hasCode = node.children.some(
        (child) => child.type === "element" && child.tagName === "code"
      );
      const isShiki = Array.isArray(node.properties?.className) && 
        (node.properties.className as string[]).includes("shiki-code-block");

      if (!hasCode && !isShiki) return;

      // Add copy button if not already present
      const hasButton = node.children.some(
        (child) => 
          child.type === "element" && 
          child.tagName === "button" && 
          Array.isArray(child.properties?.className) &&
          (child.properties.className as string[]).includes("code-copy-button")
      );

      if (hasButton) return;

      const copyButton: Element = {
        type: "element",
        tagName: "button",
        properties: {
          className: ["code-copy-button"],
          type: "button",
          ariaLabel: "Copy code",
        },
        children: [
          {
            type: "element",
            tagName: "svg",
            properties: {
              width: "16",
              height: "16",
              viewBox: "0 0 16 16",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round",
            },
            children: [
              {
                type: "element",
                tagName: "rect",
                properties: {
                  x: "5",
                  y: "5",
                  width: "9",
                  height: "9",
                  rx: "1",
                },
                children: [],
              },
              {
                type: "element",
                tagName: "path",
                properties: {
                  d: "M3 11V3a1 1 0 0 1 1-1h8",
                },
                children: [],
              },
            ],
          },
        ],
      };

      node.children.push(copyButton);
    });

    return tree;
  };
};
