import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkGithubAlerts from "remark-github-alerts";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import rehypeSlug from "rehype-slug";
import raw from "rehype-raw";
import { rehypeUrlPolicy, sanitizeSchema } from "./sanitize";
import { rehypeShiki } from "./rehype-shiki";
import { rehypeMermaid } from "./rehype-mermaid";
import { extractText } from "./hast-utils";
import { splitYamlFrontMatter } from "./design/extract/yaml";
import type { Element, Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";

const MATH_DELIMITER_RE = /\$[^$]+\$|\$\$[^$]+\$\$/;

export interface OutlineEntry {
  text: string;
  level: number;
  id: string;
}

export interface ParseResult {
  html: string;
  outline: OutlineEntry[];
  hasMath: boolean;
}

export interface ParseOptions {
  skipShiki?: boolean;
  skipMermaid?: boolean;
}

function extractOutline(tree: HastRoot): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  visit(tree, "element", (node: Element) => {
    if (/^h[1-6]$/.test(node.tagName)) {
      const level = parseInt(node.tagName.charAt(1), 10);
      const id = typeof node.properties?.id === "string" ? node.properties.id : "";
      const text = extractText(node);
      entries.push({ text, level, id });
    }
  });
  return entries;
}

export function detectMath(content: string): boolean {
  const { body } = splitYamlFrontMatter(content);
  return MATH_DELIMITER_RE.test(body);
}

export async function parseMarkdown(content: string, options?: ParseOptions): Promise<ParseResult> {
  let capturedOutline: OutlineEntry[] = [];
  const { body } = splitYamlFrontMatter(content);
  const hasMath = MATH_DELIMITER_RE.test(body);

  const captureOutline = () => (tree: HastRoot) => {
    capturedOutline = extractOutline(tree);
  };

  const skipShiki = options?.skipShiki ?? false;
  const skipMermaid = options?.skipMermaid ?? false;

  const pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkGithubAlerts)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(raw);

  if (hasMath) {
    pipeline.use(rehypeKatex);
  }

  if (!skipMermaid) {
    pipeline.use(rehypeMermaid);
  }

  if (!skipShiki) {
    pipeline.use(rehypeShiki);
  }

  pipeline
    .use(rehypeSlug)
    .use(rehypeSanitize, sanitizeSchema)
    .use(captureOutline)
    .use(rehypeUrlPolicy)
    .use(rehypeStringify, { allowDangerousHtml: true });

  const htmlFile = await pipeline.process(body);

  return { html: String(htmlFile), outline: capturedOutline, hasMath };
}
