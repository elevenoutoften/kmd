import { fromMarkdown } from "mdast-util-from-markdown";
import type { Heading, Paragraph, List, Code, Root } from "mdast";
import { visit } from "unist-util-visit";
import { splitYamlFrontMatter } from "./extract/yaml";

export interface DesignModeSection {
  title: string;
  summary?: string;
  entries: string[];
  subsections: DesignModeSection[];
}

export interface ProseDesignSpec {
  title: string;
  sections: DesignModeSection[];
}

export interface DesignModeDocumentSummary {
  title: string;
  excerpt?: string;
  headings: string[];
  stats: {
    wordCount: number;
    headingCount: number;
    listCount: number;
    codeBlockCount: number;
  };
}

const DESIGN_SECTION_HEADING = /^\s{0,3}#{1,3}\s+(colors?|typography|spacing|radii?|radius|rounded?|elevation|shadows?|surfaces?|layout|components?|palette|tokens?)\b/gim;
const DESIGN_TOKEN_LINE = /^\s*(?:[-*+]\s*)?(?:--)?[a-z0-9][\w-]*\s*:\s*(?:#[0-9a-f]{3,8}|\{[^}]+\}|var\(--[\w-]+\)|[0-9.]+(?:px|rem|em|%)?|["'][^"']+["'])\s*$/gim;
const CSS_CUSTOM_PROPERTY_LINE = /^\s*--[\w-]+\s*:\s*.+$/gim;

export function hasDesignTokens(content: string): boolean {
  const { frontmatter, body } = splitYamlFrontMatter(content);
  if (frontmatter.trim()) {
    const hasDesignKey = /^(?:colors?|typography|spacing|radii?|rounded?|elevation|surfaces?|layout|components?|palette)\s*:/m.test(frontmatter);
    if (hasDesignKey) return true;
  }

  const tokenLineCount = body.match(DESIGN_TOKEN_LINE)?.length ?? 0;
  const cssVarCount = body.match(CSS_CUSTOM_PROPERTY_LINE)?.length ?? 0;
  const headingCount = body.match(DESIGN_SECTION_HEADING)?.length ?? 0;

  return tokenLineCount >= 3 || cssVarCount >= 3 || (headingCount >= 2 && tokenLineCount >= 2);
}

function phrasingText(nodes: Array<{ type: string; value?: string; children?: unknown }>): string {
  return nodes
    .map((n) => {
      if ("value" in n && typeof n.value === "string") return n.value;
      if ("children" in n && Array.isArray(n.children))
        return phrasingText(n.children as Array<{ type: string; value?: string; children?: unknown }>);
      return "";
    })
    .join("");
}

export function summarizeMarkdownForDesignMode(content: string): DesignModeDocumentSummary {
  const { frontmatter, body } = splitYamlFrontMatter(content);

  let title = "";
  let excerpt: string | undefined;
  const headings: string[] = [];
  let wordCount = 0;
  let headingCount = 0;
  let listCount = 0;
  let codeBlockCount = 0;

  if (frontmatter.trim()) {
    const nameMatch = /^(?:name|title)\s*:\s*(.+)$/m.exec(frontmatter);
    if (nameMatch?.[1]) title = nameMatch[1].trim().replace(/^["']|["']$/g, "");
    const descMatch = /^(?:description|desc)\s*:\s*(.+)$/m.exec(frontmatter);
    if (descMatch?.[1]) excerpt = descMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  let tree: Root;
  try {
    tree = fromMarkdown(body);
  } catch {
    return { title: title || "Untitled", excerpt, headings, stats: { wordCount: 0, headingCount: 0, listCount: 0, codeBlockCount: 0 } };
  }

  visit(tree, (node) => {
    if (node.type === "heading") {
      const h = node as Heading;
      const text = phrasingText(h.children as Array<{ type: string; value?: string; children?: unknown }>).trim();
      if (text) {
        headings.push(text);
        headingCount++;
      }
      if (!title && h.depth === 1) title = text;
    }
    if (node.type === "paragraph") {
      const p = node as Paragraph;
      const text = phrasingText(p.children as Array<{ type: string; value?: string; children?: unknown }>).trim();
      if (text) {
        const words = text.split(/\s+/).length;
        wordCount += words;
        if (!excerpt && text.length > 20) excerpt = text.length > 200 ? text.slice(0, 200) + "..." : text;
      }
    }
    if (node.type === "list") {
      listCount++;
      const list = node as List;
      for (const item of list.children) {
        for (const child of item.children) {
          if (child.type === "paragraph") {
            wordCount += phrasingText((child as Paragraph).children as Array<{ type: string; value?: string; children?: unknown }>).split(/\s+/).length;
          }
        }
      }
    }
    if (node.type === "code") {
      codeBlockCount++;
      wordCount += (node as Code).value.split(/\s+/).length;
    }
  });

  return { title: title || "Untitled", excerpt, headings, stats: { wordCount, headingCount, listCount, codeBlockCount } };
}

export function parseProseDesignSpec(content: string): ProseDesignSpec {
  const { body } = splitYamlFrontMatter(content);

  let tree: Root;
  try {
    tree = fromMarkdown(body);
  } catch {
    return { title: "", sections: [] };
  }

  let title = "";
  const sections: DesignModeSection[] = [];
  let currentSection: DesignModeSection | null = null;
  let currentSubsection: DesignModeSection | null = null;

  visit(tree, (node) => {
    if (node.type === "heading") {
      const h = node as Heading;
      const text = phrasingText(h.children as Array<{ type: string; value?: string; children?: unknown }>).trim();
      if (!text) return;

      if (h.depth === 1 && !title) {
        title = text;
        return;
      }

      if (h.depth === 2) {
        currentSection = { title: text, entries: [], subsections: [] };
        sections.push(currentSection);
        currentSubsection = null;
      } else if (h.depth === 3 && currentSection) {
        currentSubsection = { title: text, entries: [], subsections: [] };
        currentSection.subsections.push(currentSubsection);
      }
      return;
    }

    if (node.type === "paragraph") {
      const p = node as Paragraph;
      const text = phrasingText(p.children as Array<{ type: string; value?: string; children?: unknown }>).trim();
      if (!text) return;
      const target = currentSubsection ?? currentSection;
      if (!target) return;
      if (looksLikeDesignEntry(text)) {
        if (!target.entries.includes(text)) {
          target.entries.push(text);
        }
        return;
      }
      if (!target.summary) {
        target.summary = text;
      }
      return;
    }

    if (node.type === "listItem") {
      const li = node as import("mdast").ListItem;
      const para = li.children.find((c): c is Paragraph => c.type === "paragraph");
      if (!para) return;
      const text = phrasingText(para.children as Array<{ type: string; value?: string; children?: unknown }>).trim();
      if (!text) return;
      const target = currentSubsection ?? currentSection;
      if (target) {
        if (!target.entries.includes(text)) {
          target.entries.push(text);
        }
      }
    }
  });

  return { title, sections };
}

function looksLikeDesignEntry(text: string): boolean {
  return /^([A-Za-z0-9][A-Za-z0-9\s/#()._-]{0,80})(:|\s+-\s+)\S/.test(text);
}
