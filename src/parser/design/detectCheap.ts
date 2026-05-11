import { splitYamlFrontMatter } from "./extract/yaml";

export interface Signal {
  signal: string;
  points: number;
}

export interface DetectionOutput {
  score: number;
  signals: Signal[];
  threshold: number;
}

const DESIGN_YAML_KEYS = new Set([
  "colors",
  "typography",
  "spacing",
  "radius",
  "radii",
  "elevation",
  "surfaces",
  "rounded",
  "layout",
  "components",
]);

const HEADING_PATTERNS: ReadonlyArray<{ pattern: RegExp }> = [
  { pattern: /\bcolou?rs?\b/i },
  { pattern: /\btypo(?:graphy)?\b|\btype\s*scale\b/i },
  { pattern: /\bspacing\b/i },
  { pattern: /\bradiu?s\b|\brounded?\b|\bshape/i },
  { pattern: /\bsurfaces?\b/i },
  { pattern: /\belevation\b|\bshadows?\b/i },
  { pattern: /\blayout\b/i },
  { pattern: /\bcomponents?\b|\bbuttons?\b|\bcards?\b/i },
];

const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

const DESIGN_SYSTEM_PROSE_RE = /\b(?:design\s+system|design\s+tokens?|component\s+library|token\s+inventory)\b/i;
const COMPONENT_STYLE_RE = /`[^`]*(?:bg|background|text|border|radius|padding|height|font|hover|focus)\s*:\s*[^`]*`/gi;

export function detectDesignDocumentCheap(
  content: string,
  filename?: string,
): DetectionOutput {
  const signals: Signal[] = [];
  scoreCheapSignals(content, filename, signals);
  const score = signals.reduce((sum, s) => sum + s.points, 0);
  return { score, signals, threshold: 5 };
}

export function scoreCheapSignals(
  content: string,
  filename: string | undefined,
  signals: Signal[],
): void {
  if (filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith("design.md") || lower.endsWith("-design.md")) {
      signals.push({ signal: "Filename ends in DESIGN.md", points: 5 });
    }
  }

  const { frontmatter } = splitYamlFrontMatter(content);
  if (frontmatter.trim()) {
    const fmLines = frontmatter.split("\n");
    const topLevelKeys = new Set<string>();
    for (const line of fmLines) {
      const m = line.match(/^(\w[\w-]*)\s*:/);
      if (m) topLevelKeys.add(m[1]!);
    }
    const designKeys = [...topLevelKeys].filter((k) => DESIGN_YAML_KEYS.has(k));
    if (designKeys.length >= 2) {
      signals.push({
        signal: `YAML frontmatter has design keys (${designKeys.join(", ")})`,
        points: 5,
      });
    }
  }

  const hasRootCss = /:root\s*\{/.test(content);
  const hasThemeCss = /@theme\s*\{/.test(content);
  if (hasRootCss || hasThemeCss) {
    const label = hasRootCss ? ":root" : "@theme";
    signals.push({ signal: `CSS block (${label})`, points: 2 });
  }

  const hexMatches = content.match(HEX_COLOR_RE);
  if (hexMatches && hexMatches.length >= 10) {
    signals.push({
      signal: `>=10 hex codes (${hexMatches.length})`,
      points: 1,
    });
  }

  const headingRe = /^#{1,6}\s+(.+)$/gm;
  let headingMatches = 0;
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(content)) !== null) {
    const text = m[1];
    for (const { pattern } of HEADING_PATTERNS) {
      if (pattern.test(text!)) {
        headingMatches++;
        break;
      }
    }
  }
  const cappedHeadings = Math.min(headingMatches, 3);
  if (cappedHeadings > 0) {
    signals.push({
      signal: `Design-shaped headings (${cappedHeadings})`,
      points: cappedHeadings,
    });
  }

  if (
    hexMatches &&
    hexMatches.length >= 10 &&
    headingMatches >= 3 &&
    DESIGN_SYSTEM_PROSE_RE.test(content)
  ) {
    signals.push({
      signal: "Token-heavy design system prose",
      points: 1,
    });
  }

  const componentStyleMatches = content.match(COMPONENT_STYLE_RE);
  if (componentStyleMatches && componentStyleMatches.length >= 5) {
    signals.push({
      signal: `Component style snippets (${componentStyleMatches.length})`,
      points: 1,
    });
  }
}
