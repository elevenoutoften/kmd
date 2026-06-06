import type { Plugin } from "unified";
import type { Element, Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";
import { extractText } from "./hast-utils";

import type { HighlighterCore, LanguageRegistration } from "shiki/core";

type LanguageLoader = () => Promise<LanguageRegistration | LanguageRegistration[]>;

let highlighterCache: Promise<HighlighterCore> | null = null;
const loadedLangs = new Set<string>(["plaintext"]);

const LANGUAGE_ALIASES: Record<string, string> = {
  csharp: "csharp",
  cs: "csharp",
  docker: "dockerfile",
  dockerfile: "dockerfile",
  htm: "html",
  html: "html",
  js: "javascript",
  javascript: "javascript",
  jsx: "jsx",
  md: "markdown",
  markdown: "markdown",
  ps: "powershell",
  ps1: "powershell",
  py: "python",
  python: "python",
  rs: "rust",
  rust: "rust",
  sh: "shellscript",
  shell: "shellscript",
  bash: "shellscript",
  shellscript: "shellscript",
  ts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
};

const SHIKI_LANG_ALIASES = Object.fromEntries(
  Object.entries(LANGUAGE_ALIASES).filter(([alias, lang]) => alias !== lang)
);

const LANGUAGE_LOADERS: Record<string, LanguageLoader> = {
  c: () => import("@shikijs/langs/c").then((m) => m.default),
  cpp: () => import("@shikijs/langs/cpp").then((m) => m.default),
  csharp: () => import("@shikijs/langs/csharp").then((m) => m.default),
  css: () => import("@shikijs/langs/css").then((m) => m.default),
  diff: () => import("@shikijs/langs/diff").then((m) => m.default),
  dockerfile: () => import("@shikijs/langs/dockerfile").then((m) => m.default),
  go: () => import("@shikijs/langs/go").then((m) => m.default),
  html: () => import("@shikijs/langs/html").then((m) => m.default),
  java: () => import("@shikijs/langs/java").then((m) => m.default),
  javascript: () => import("@shikijs/langs/javascript").then((m) => m.default),
  json: () => import("@shikijs/langs/json").then((m) => m.default),
  jsx: () => import("@shikijs/langs/jsx").then((m) => m.default),
  markdown: () => import("@shikijs/langs/markdown").then((m) => m.default),
  php: () => import("@shikijs/langs/php").then((m) => m.default),
  powershell: () => import("@shikijs/langs/powershell").then((m) => m.default),
  python: () => import("@shikijs/langs/python").then((m) => m.default),
  ruby: () => import("@shikijs/langs/ruby").then((m) => m.default),
  rust: () => import("@shikijs/langs/rust").then((m) => m.default),
  shellscript: () => import("@shikijs/langs/shellscript").then((m) => m.default),
  sql: () => import("@shikijs/langs/sql").then((m) => m.default),
  swift: () => import("@shikijs/langs/swift").then((m) => m.default),
  toml: () => import("@shikijs/langs/toml").then((m) => m.default),
  tsx: () => import("@shikijs/langs/tsx").then((m) => m.default),
  typescript: () => import("@shikijs/langs/typescript").then((m) => m.default),
  xml: () => import("@shikijs/langs/xml").then((m) => m.default),
  yaml: () => import("@shikijs/langs/yaml").then((m) => m.default),
};

function normalizeLanguage(lang: string): string {
  const normalized = lang.trim().toLowerCase();
  return LANGUAGE_ALIASES[normalized] ?? normalized;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterCache) {
    highlighterCache = Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("@shikijs/themes/github-dark-default"),
      import("@shikijs/themes/github-light-default"),
    ]).then(async ([core, engine, githubDark, githubLight]) => {
      return core.createHighlighterCore({
        engine: engine.createJavaScriptRegexEngine(),
        themes: [githubDark.default, githubLight.default],
        langs: [],
        langAlias: SHIKI_LANG_ALIASES,
      });
    });
  }
  return highlighterCache;
}

async function ensureLanguage(lang: string): Promise<boolean> {
  const resolvedLang = normalizeLanguage(lang);
  if (loadedLangs.has(resolvedLang)) return true;
  if (resolvedLang === "text" || resolvedLang === "plain" || resolvedLang === "plaintext") return true;

  const loader = LANGUAGE_LOADERS[resolvedLang];
  if (!loader) return false;

  try {
    const highlighter = await getHighlighter();
    await highlighter.loadLanguage(await loader());
    loadedLangs.add(resolvedLang);
    return true;
  } catch {
    return false;
  }
}

export function disposeShikiHighlighter(): void {
  if (highlighterCache) {
    highlighterCache.then((h) => h.dispose()).catch(() => {});
    highlighterCache = null;
  }
  loadedLangs.clear();
  loadedLangs.add("plaintext");
}

export function getLoadedShikiLanguages(): ReadonlySet<string> {
  return loadedLangs;
}

const MERMAID_LANG = "mermaid";

export const rehypeShiki: Plugin<[], HastRoot, HastRoot> = function () {
  return async (tree: HastRoot): Promise<HastRoot> => {
    const codeBlocks: { node: Element; pre: Element; lang: string; code: string }[] = [];

    visit(tree, "element", (node: Element, _index, parent) => {
      if (node.tagName !== "code" || !parent || parent.type !== "element" || parent.tagName !== "pre") return;

      const classes = (node.properties?.className as string[]) ?? [];
      const langClass = classes.find((c) => c.startsWith("language-"));
      if (!langClass) return;

      const lang = langClass.replace("language-", "");
      if (lang.toLowerCase() === MERMAID_LANG) return;

      const code = extractText(node);
      if (!code) return;

      codeBlocks.push({ node, pre: parent as Element, lang, code });
    });

    if (codeBlocks.length === 0) return tree;

    try {
      const highlighter = await getHighlighter();

      const uniqueLangs = [...new Set(codeBlocks.map((b) => normalizeLanguage(b.lang)))];
      await Promise.all(uniqueLangs.map((lang) => ensureLanguage(lang)));

      for (const { pre, lang, code } of codeBlocks) {
        try {
          const loaded = highlighter.getLoadedLanguages();
          const normalizedLang = normalizeLanguage(lang);
          const resolvedLang = loaded.includes(lang)
            ? lang
            : loaded.includes(normalizedLang)
              ? normalizedLang
              : "plaintext";

          const html = highlighter.codeToHtml(code, {
            lang: resolvedLang,
            themes: {
              dark: "github-dark-default",
              light: "github-light-default",
            },
          });

          const codeElementMatch = html.match(/<code[^>]*>[\s\S]*?<\/code>/i);
          const codeElement = codeElementMatch ? codeElementMatch[0] : `<code>${escapeHtml(code)}</code>`;

          pre.tagName = "pre";
          pre.properties = {
            ...pre.properties,
            className: ["shiki-code-block"],
            dataLanguage: resolvedLang,
          };
          pre.children = [{ type: "raw" as const, value: codeElement }];
        } catch {
          // leave unhighlighted
        }
      }
    } catch {
      // Shiki failed to load entirely — leave all code blocks unhighlighted.
    }

    return tree;
  };
};
