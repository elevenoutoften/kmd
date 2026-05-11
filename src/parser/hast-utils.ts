import type { Element, Root as HastRoot } from "hast";

export function extractText(node: Element | HastRoot): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node && Array.isArray((node as { children: unknown }).children)) {
    return (node as { children: { type: string; value?: string }[] }).children
      .map((child) => {
        if (child.type === "text" && "value" in child) return (child as { value: string }).value;
        if (child.type === "element") return extractText(child as Element);
        return "";
      })
      .join("");
  }
  return "";
}
