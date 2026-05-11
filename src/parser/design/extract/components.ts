import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import type {
  Parents,
  Root,
  Heading,
  ListItem,
  List,
  Paragraph,
  PhrasingContent,
} from "mdast";
import type {
  ComponentRecipe,
  DesignDocument,
  Provenance,
} from "../ir";
import { splitYamlFrontMatter } from "./yaml";

const SECTION_PATTERNS: ReadonlyArray<{
  category: string;
  pattern: RegExp;
}> = [
  {
    category: "component",
    pattern:
      /\bcomponents?\b|\bbuttons?\b|\bcards?\b|\binputs?\b|\bchips?\b|\bbadges?\b|\btooltip/i,
  },
];

function isComponentSection(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, " ");
  return SECTION_PATTERNS.some(({ pattern }) => pattern.test(normalized));
}

const FAMILY_MAP: ReadonlyArray<{ family: string; pattern: RegExp }> = [
  { family: "button", pattern: /\bbuttons?\b/i },
  { family: "card", pattern: /\bcards?\b/i },
  { family: "input", pattern: /\binputs?\b/i },
  { family: "chip", pattern: /\bchips?\b/i },
  { family: "badge", pattern: /\bbadges?\b/i },
  { family: "tooltip", pattern: /\btooltips?\b/i },
];

function inferFamily(text: string): string | undefined {
  for (const { family, pattern } of FAMILY_MAP) {
    if (pattern.test(text)) return family;
  }
  return undefined;
}

function phrasingText(nodes: PhrasingContent[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text") return n.value;
      if (n.type === "inlineCode") return n.value;
      if ("children" in n) return phrasingText(n.children as PhrasingContent[]);
      return "";
    })
    .join("");
}

function makeProvenance(sourceLine: number): Provenance {
  return { extractor: "component", sourceLine };
}

interface BoldPair {
  name: string;
  rest: string;
}

function parseBoldPair(para: Paragraph): BoldPair | undefined {
  const children = para.children;
  if (children.length === 0) return undefined;
  if (children[0]?.type !== "strong") return undefined;

  const name = phrasingText(children[0].children);
  const restParts: string[] = [];

  for (let i = 1; i < children.length; i++) {
    const child = children[i]!;
    if (child.type === "text") {
      restParts.push(child.value);
    } else if (child.type === "inlineCode") {
      restParts.push(child.value);
    } else if ("children" in child) {
      restParts.push(phrasingText((child as { children: PhrasingContent[] }).children));
    }
  }

  const rawRest = restParts.join("");
  const rest = rawRest.replace(/^[\s:—–-]+/, "");
  return { name, rest };
}

function nodeLine(node: Parents, fallback: number, offset: number): number {
  return offset + (node.position?.start.line ?? fallback);
}

// ---------------------------------------------------------------------------
// Key normalisation
// ---------------------------------------------------------------------------

const KEY_ALIASES: ReadonlyArray<{ patterns: RegExp[]; normalized: string }> = [
  { patterns: [/^backgroundcolor$/i, /^bg$/i], normalized: "background" },
  { patterns: [/^textcolor$/i, /^foreground$/i, /^color$/i, /^text$/i], normalized: "foreground" },
  { patterns: [/^bordercolor$/i], normalized: "border-color" },
  { patterns: [/^borderwidth$/i], normalized: "border-width" },
  { patterns: [/^borderradius$/i, /^rounded$/i], normalized: "radius" },
  { patterns: [/^minheight$/i], normalized: "height" },
  { patterns: [/^hoverbackgroundcolor$/i, /^hoverbg$/i, /^hovercolor$/i, /^hoverbackground$/i], normalized: "hover-background" },
  { patterns: [/^focusring$/i, /^focusbordercolor$/i, /^focusborder$/i], normalized: "focus-ring" },
  { patterns: [/^fontfamily$/i], normalized: "font-family" },
  { patterns: [/^fontsize$/i], normalized: "font-size" },
  { patterns: [/^fontweight$/i], normalized: "font-weight" },
  { patterns: [/^placeholdercolor$/i, /^placeholder$/i], normalized: "placeholder-color" },
];

function normalizeKey(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  for (const { patterns, normalized } of KEY_ALIASES) {
    for (const p of patterns) {
      if (p.test(cleaned)) return normalized;
    }
  }
  return raw.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function normalizeRadiusValue(value: string): string {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "none" || lower === "0" || lower === "zero") return "0px";
  if (/^0(\.0+)?px$/.test(lower)) return "0px";
  return trimmed;
}

function normalizeProps(props: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    const nk = normalizeKey(key);
    let nv = value;
    if (nk === "radius") {
      nv = normalizeRadiusValue(value);
    }
    if (!(nk in out)) {
      out[nk] = nv;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Border shorthand parsing
// ---------------------------------------------------------------------------

function fixBorderShorthand(value: string): string {
  const m = /^(\d+(?:\.\d+)?px)\s+(#[0-9a-fA-F]{3,8})$/.exec(value.trim());
  if (m) return `${m[1]} solid ${m[2]}`;
  const m2 = /^(\d+(?:\.\d+)?px)\s+solid\s+(#[0-9a-fA-F]{3,8})$/i.exec(value.trim());
  if (m2) return value.trim();
  return value;
}

// ---------------------------------------------------------------------------
// Inline prop key: value parsing (handles `bg: #FFFFFF, border: 1.5px #D4D4D4, ...`)
// ---------------------------------------------------------------------------

const INLINE_KEY_VALUE_RE = /(?:^|[\s,])((?:hover-background|hover-bg|hover-color|hoverBackgroundColor|hoverBackground|focus-border|focus-ring|focusRing|focus-border-color|focus-ring-color|background-color|backgroundColor|border-color|borderColor|border-width|borderWidth|border-radius|borderRadius|font-family|fontFamily|font-size|fontSize|font-weight|fontWeight|placeholder-color|placeholderColor|min-height|minHeight|background|foreground|border|rounded|padding|height|radius|text-color|textColor|placeholder|font|color|text|bg|hover|focus)):\s*(`[^`]+`|#[0-9a-fA-F]{3,8}|\d+(?:\.\d+)?px(?:\s+solid)?(?:\s+#[0-9a-fA-F]{3,8})?|\d+(?:\.\d+)?(?:px\s*)+(?:[\d]+(?:\.\d+)?(?:px\s*)*)?|\w[\w\s]*?)(?=[,\s.]*(?:[a-z-]+:)|[,.]|$)/gi;

function parseInlineKeyValues(text: string): Record<string, string> {
  const props: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = INLINE_KEY_VALUE_RE.exec(text)) !== null) {
    const rawKey = m[1]!.trim();
    let rawVal = m[2]!.trim();
    if (rawVal.startsWith("`") && rawVal.endsWith("`")) {
      rawVal = rawVal.slice(1, -1);
    }
    const nk = normalizeKey(rawKey);
    if (nk === "border") {
      rawVal = fixBorderShorthand(rawVal);
    }
    if (!(nk in props)) {
      props[nk] = rawVal;
    }
  }
  return props;
}

// ---------------------------------------------------------------------------
// Hover/focus extraction from prose patterns
// ---------------------------------------------------------------------------

function extractHoverProps(text: string): Record<string, string> {
  const props: Record<string, string> = {};

  const hoverInline = /\bhover:\s*(#[0-9a-fA-F]{3,8})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = hoverInline.exec(text)) !== null) {
    if (!("hover-background" in props)) {
      props["hover-background"] = m[1]!;
    }
  }

  const hoverDesc = /\bHover:\s*background\s+(#[0-9a-fA-F]{3,8})\b/gi;
  while ((m = hoverDesc.exec(text)) !== null) {
    props["hover-background"] = m[1]!;
  }

  const hoverDesc2 = /\bHover:\s*Background\s+(#[0-9a-fA-F]{3,8})\b/gi;
  while ((m = hoverDesc2.exec(text)) !== null) {
    props["hover-background"] = m[1]!;
  }

  return props;
}

function extractFocusProps(text: string): Record<string, string> {
  const props: Record<string, string> = {};

  const focusBorderHex = /\bfocus:\s*border\s+(#[0-9a-fA-F]{3,8})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = focusBorderHex.exec(text)) !== null) {
    if (!("focus-ring" in props)) {
      props["focus-ring"] = m[1]!;
    }
  }

  const focusRing = /\bfocus:\s*(?:border\s+)?(?:#[0-9a-fA-F]{3,8}\s*,?\s*)?ring\s+(\d+(?:\.\d+)?px)\s+(#[0-9a-fA-F]{3,8})/gi;
  while ((m = focusRing.exec(text)) !== null) {
    props["focus-ring"] = m[2]!;
    props["focus-ring-width"] = m[1]!;
  }

  const focusBorderGeneric = /\bfocus[-\s]?(?:border|ring):\s*(#[0-9a-fA-F]{3,8})\b/gi;
  while ((m = focusBorderGeneric.exec(text)) !== null) {
    if (!("focus-ring" in props)) {
      props["focus-ring"] = m[1]!;
    }
  }

  const focusRingOffset = /\bfocus:\s*border\s+#[0-9a-fA-F]{3,8},?\s*ring\s+\d+(?:\.\d+)?px\s+(?:offset\s+)?(?:#[0-9a-fA-F]{3,8})?/gi;
  if (focusRingOffset.test(text) && !("focus-ring" in props)) {
    const hexM = /(?:ring\s+\d+(?:\.\d+)?px\s+(?:offset\s+)?)(#[0-9a-fA-F]{3,8})/i.exec(text);
    if (hexM) props["focus-ring"] = hexM[1]!;
  }

  return props;
}

// ---------------------------------------------------------------------------
// Legacy property extraction (parenthesised hex, standalone hex, etc.)
// ---------------------------------------------------------------------------

const INLINE_PROP_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  key: string;
}> = [
  { pattern: /(?:^|[\s,])bg:\s*(#?\w[\w\s]*?)(?:[,\s.]|$)/i, key: "background" },
  { pattern: /background:\s*(#?\w[\w\s]*?)(?:[,\s.]|$)/i, key: "background" },
  { pattern: /(?:^|[\s,])text:\s*(#?\w+)(?:[,\s.]|$)/i, key: "foreground" },
  { pattern: /foreground:\s*(#?\w+)(?:[,\s.]|$)/i, key: "foreground" },
  { pattern: /radius:\s*([\d]+(?:\.\d+)?(?:px)?)/i, key: "radius" },
  { pattern: /padding:\s*([\d]+(?:\.\d+)?(?:px\s*)+(?:[\d]+(?:\.\d+)?(?:px\s*)*)?)/i, key: "padding" },
  { pattern: /border:\s*([\d]+(?:\.\d+)?px\s+\w+\s+#?\w+)/i, key: "border" },
  { pattern: /hover:\s*(#[0-9a-fA-F]{3,8})\b/i, key: "hover-background" },
  { pattern: /(\d+)px\s+(?:border\s+)?radius/i, key: "radius" },
];

function extractParensHex(
  text: string,
): Array<{ key: string; value: string }> {
  const results: Array<{ key: string; value: string }> = [];
  const re = /(\w[\w\s]*?)?\s*\(#([0-9a-fA-F]{3,8})\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const prefix = (m[1] ?? "").trim().toLowerCase();
    const hex = `#${m[2]}`;
    let key = "background";
    if (prefix.includes("text") || prefix.includes("foreground")) {
      key = "foreground";
    } else if (prefix.includes("border")) {
      key = "border-color";
    }
    results.push({ key, value: hex });
  }
  return results;
}

function extractInlineProps(text: string): Record<string, string> {
  const kvProps = parseInlineKeyValues(text);
  if (Object.keys(kvProps).length > 0) return kvProps;

  const props: Record<string, string> = {};

  for (const { pattern, key } of INLINE_PROP_PATTERNS) {
    const m = pattern.exec(text);
    if (m && m[1]) {
      if (!(key in props)) {
        props[key] = m[1].trim();
      }
    }
  }

  for (const { key, value } of extractParensHex(text)) {
    if (!(key in props)) {
      props[key] = value;
    }
  }

  const namedColorRef =
    /\b(?:Text\s+\w+|Border|Surface)\s+\w+\s*\((#[0-9a-fA-F]{3,8})\)/g;
  let nc: RegExpExecArray | null;
  while ((nc = namedColorRef.exec(text)) !== null) {
    if (!("foreground" in props)) {
      props["foreground"] = nc[1]!;
    }
  }

  const standaloneHex = /(?:^|[\s,])+(#[0-9a-fA-F]{3,8})\b/g;
  let sh: RegExpExecArray | null;
  while ((sh = standaloneHex.exec(text)) !== null) {
    const hex = sh[1]!;
    if (!Object.values(props).includes(hex)) {
      const before = text.slice(0, sh.index);
      if (/\bbackground\b/i.test(before) && !("background" in props)) {
        props["background"] = hex;
      } else if (/\bborder\b/i.test(before) && !("border-color" in props)) {
        props["border-color"] = hex;
      } else if (/\btext\b/i.test(before) && !("foreground" in props)) {
        props["foreground"] = hex;
      }
    }
  }

  if (/\bpill(?:\s+shape)?\b/i.test(text)) {
    props["shape"] = "pill";
  }

  if (/\bno\s+border\b/i.test(text)) {
    props["border"] = "none";
  }

  if (/\btransparent\s+background\b/i.test(text)) {
    props["background"] = "transparent";
  }

  const radiusMatch = /\b(\d+(?:px)?)\s+(?:border\s+)?radius\b/i.exec(text);
  if (radiusMatch && !("radius" in props)) {
    props["radius"] = radiusMatch[1]!;
  }

  const borderSizeMatch =
    /\b(\d+(?:\.\d+)?px)\s+(?:#[0-9a-fA-F]{3,8}\s+)?border(?!\s+radius)/i.exec(text);
  if (borderSizeMatch && !("border-width" in props)) {
    props["border-width"] = borderSizeMatch[1]!;
  }

  const elevMatch = /\b(Small|Medium|Large|Extra\s*Large|Subtle|Overlay)\s+elevation\b/i.exec(
    text,
  );
  if (elevMatch) {
    props["elevation"] = elevMatch[1]!.replace(/\s+/g, " ").trim();
  }

  return props;
}

// ---------------------------------------------------------------------------
// State extraction
// ---------------------------------------------------------------------------

const STATE_KEYWORDS = [
  "hover",
  "active",
  "focus",
  "disabled",
  "selected",
  "error",
] as const;

function extractStates(
  text: string,
): { base: Record<string, string>; states: Record<string, Record<string, string>> } {
  const base = extractInlineProps(text);
  const states: Record<string, Record<string, string>> = {};

  for (const state of STATE_KEYWORDS) {
    const stateRe = new RegExp(
      `\\b${state}:\\s*([^,.]+?)(?:[,.]|$)`,
      "gi",
    );
    const m = stateRe.exec(text);
    if (m && m[1]) {
      const stateProps = parseStateValue(m[1].trim());
      if (Object.keys(stateProps).length > 0) {
        states[state] = stateProps;
      }
    }
  }

  const hoverProps = extractHoverProps(text);
  if (Object.keys(hoverProps).length > 0) {
    if (!states.hover) states.hover = {};
    for (const [k, v] of Object.entries(hoverProps)) {
      if (!(k in states.hover)) states.hover[k] = v;
    }
  }

  const focusProps = extractFocusProps(text);
  if (Object.keys(focusProps).length > 0) {
    if (!states.focus) states.focus = {};
    for (const [k, v] of Object.entries(focusProps)) {
      if (!(k in states.focus)) states.focus[k] = v;
    }
  }

  return { base, states };
}

function parseStateValue(value: string): Record<string, string> {
  const props: Record<string, string> = {};

  const hexMatch = /(#(?:[0-9a-fA-F]{3,8}))\b/.exec(value);
  if (hexMatch && hexMatch[1]) {
    const before = value.slice(0, hexMatch.index).toLowerCase();
    if (before.includes("text") || before.includes("foreground")) {
      props.foreground = hexMatch[1];
    } else if (before.includes("border")) {
      props["border-color"] = hexMatch[1];
    } else {
      props.background = hexMatch[1];
    }
  }

  const kvRe = /(\w+):\s*(#?\w[\w\s]*?)(?:,|$)/g;
  let kv: RegExpExecArray | null;
  while ((kv = kvRe.exec(value)) !== null) {
    const key = kv[1]!.toLowerCase().trim();
    const val = kv[2]!.trim();
    if (key && val && !(key in props)) {
      props[key] = val;
    }
  }

  return props;
}

// ---------------------------------------------------------------------------
// Description extraction
// ---------------------------------------------------------------------------

function extractDescription(text: string): string {
  const sentenceBreak = /\.\s+([A-Z])/g;
  let lastBreak = -1;
  let m: RegExpExecArray | null;
  while ((m = sentenceBreak.exec(text)) !== null) {
    lastBreak = m.index + 1;
  }
  if (lastBreak > 0) {
    return text.slice(lastBreak).trim();
  }
  return "";
}

// ---------------------------------------------------------------------------
// Bullet-list property sub-items (ThoughtStream style)
// ---------------------------------------------------------------------------

function parsePropertyBulletList(
  list: List,
  offset: number,
): { properties: Record<string, string>; hoverProps: Record<string, string>; focusProps: Record<string, string>; sourceLine: number } | null {
  const props: Record<string, string> = {};
  const hoverProps: Record<string, string> = {};
  const focusProps: Record<string, string> = {};
  let firstLine = 0;

  for (const item of list.children) {
    const para = item.children.find(
      (c): c is Paragraph => c.type === "paragraph",
    );
    if (!para) continue;

    const line = nodeLine(item, 1, offset);
    if (firstLine === 0) firstLine = line;

    const text = phrasingText(para.children);

    const pair = parseBoldPair(para);
    if (pair && pair.rest) {
      let value = pair.rest.trim();
      if (value.startsWith("`") && value.endsWith("`")) {
        value = value.slice(1, -1);
      }
      const nk = normalizeKey(pair.name);
      if (nk === "border") {
        value = fixBorderShorthand(value);
      }
      if (nk === "radius") {
        value = normalizeRadiusValue(value);
      }
      if (!(nk in props)) {
        props[nk] = value;
      }
      continue;
    }

    const colonSplit = /^(.+?)[:]\s+(.+)$/.exec(text);
    if (colonSplit && colonSplit[1] && colonSplit[2]) {
      let key = colonSplit[1].trim();
      let value = colonSplit[2].trim();
      if (value.startsWith("`") && value.endsWith("`")) {
        value = value.slice(1, -1);
      }

      const lowerKey = key.toLowerCase();

      if (lowerKey === "hover" || lowerKey.startsWith("hover ")) {
        const hp = extractHoverProps(text);
        for (const [hk, hv] of Object.entries(hp)) {
          hoverProps[hk] = hv;
        }
        const hoverBg = /(?:background|bg)[:\s]+(#[0-9a-fA-F]{3,8})/i.exec(value);
        if (hoverBg && !("hover-background" in hoverProps)) {
          hoverProps["hover-background"] = hoverBg[1]!;
        } else if (/^#[0-9a-fA-F]{3,8}$/.test(value) && !("hover-background" in hoverProps)) {
          hoverProps["hover-background"] = value;
        }
        continue;
      }

      if (lowerKey === "focus" || lowerKey.startsWith("focus ")) {
        const fp = extractFocusProps(text);
        for (const [fk, fv] of Object.entries(fp)) {
          focusProps[fk] = fv;
        }
        if (Object.keys(fp).length === 0) {
          const focusBorderHex = /border\s+(#[0-9a-fA-F]{3,8})/i.exec(value);
          if (focusBorderHex && !("focus-ring" in focusProps)) {
            focusProps["focus-ring"] = focusBorderHex[1]!;
          }
        }
        continue;
      }

      const nk = normalizeKey(key);
      if (nk === "border") {
        value = fixBorderShorthand(value);
      }
      if (nk === "radius") {
        value = normalizeRadiusValue(value);
      }
      if (!(nk in props)) {
        props[nk] = value;
      }
    }
  }

  return Object.keys(props).length > 0 || Object.keys(hoverProps).length > 0 || Object.keys(focusProps).length > 0
    ? { properties: props, hoverProps, focusProps, sourceLine: firstLine }
    : null;
}

// ---------------------------------------------------------------------------
// Build a recipe from extracted data
// ---------------------------------------------------------------------------

function buildRecipe(
  name: string,
  base: Record<string, string>,
  states: Record<string, Record<string, string>>,
  family: string | undefined,
  restText: string,
  sourceLine: number,
): ComponentRecipe {
  const properties = normalizeProps({ ...base });

  if (family) {
    properties.family = family;
  }

  if (Object.keys(states).length > 0) {
    for (const [state, stateProps] of Object.entries(states)) {
      const nk = normalizeKey(`state-${state}`);
      if (!(nk in properties)) {
        properties[nk] = Object.entries(stateProps)
          .map(([k, v]) => `${normalizeKey(k)}: ${v}`)
          .join("; ");
      }
    }
  }

  for (const [state, stateProps] of Object.entries(states)) {
    for (const [spk, spv] of Object.entries(stateProps)) {
      const alreadyPrefixed = spk.startsWith(`${state}-`) || spk.startsWith(`${state}`);
      const flatKey = alreadyPrefixed ? normalizeKey(spk) : normalizeKey(`${state}-${spk}`);
      if (!(flatKey in properties)) {
        properties[flatKey] = spv;
      }
    }
  }

  const hasStructured = Object.keys(properties).some(
    (k) => k !== "family" && k !== "description",
  );

  const description = extractDescription(restText);
  if (description) {
    properties.description = description;
  }

  if (!hasStructured) {
    properties.description = restText;
  }

  return {
    name,
    properties,
    provenance: makeProvenance(sourceLine),
  };
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

export function extractComponents(doc: DesignDocument): void {
  const source = doc._sourceContent;
  if (!source) return;

  const { body, bodyLineOffset } = splitYamlFrontMatter(source);
  if (!body.trim()) return;

  let tree: Root;
  try {
    tree = fromMarkdown(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    doc.diagnostics.push({
      severity: "error",
      token: "",
      message: `Component extractor: markdown parse error: ${message}`,
    });
    return;
  }

  const offset = bodyLineOffset - 1;

  let inComponentSection = false;
  let currentFamily: string | undefined;

  const visitedParentLists = new Set<Parents>();

  visit(tree, (node, _index, parent) => {
    if (node.type === "heading") {
      const heading = node as Heading;
      const text = phrasingText(heading.children);

      if (isComponentSection(text)) {
        inComponentSection = true;
        currentFamily = inferFamily(text);
        return;
      }

      if (inComponentSection && heading.depth >= 3) {
        const family = inferFamily(text);
        if (family) {
          currentFamily = family;
          return;
        }
      }

      if (heading.depth <= 2 && !isComponentSection(text)) {
        inComponentSection = false;
        currentFamily = undefined;
      }
      return;
    }

    if (!inComponentSection) return;

    // Skip paragraphs/lists that are children of an already-processed list item
    if (parent && visitedParentLists.has(parent)) return;

    // Process list items (existing list-item bold-pair format)
    if (node.type === "listItem") {
      const item = node as ListItem;
      visitedParentLists.add(item);

      if (item.children.length >= 2) {
        const firstPara = item.children.find(
          (c): c is Paragraph => c.type === "paragraph",
        );
        const firstList = item.children.find(
          (c): c is List => c.type === "list",
        );
        if (firstPara && firstList && !visitedParentLists.has(firstList)) {
          visitedParentLists.add(firstList);
          let componentName: string | undefined;
          if (firstPara.children[0]?.type === "strong") {
            componentName = phrasingText(firstPara.children[0].children);
          } else {
            componentName = phrasingText(firstPara.children);
          }
          if (componentName) {
            const bulletResult = parsePropertyBulletList(firstList, offset);
            if (bulletResult) {
              const states: Record<string, Record<string, string>> = {};
              const paraHoverProps = extractHoverProps(phrasingText(firstPara.children));
              const paraFocusProps = extractFocusProps(phrasingText(firstPara.children));
              const mergedHover = { ...paraHoverProps, ...bulletResult.hoverProps };
              const mergedFocus = { ...paraFocusProps, ...bulletResult.focusProps };
              if (Object.keys(mergedHover).length > 0) states.hover = mergedHover;
              if (Object.keys(mergedFocus).length > 0) states.focus = mergedFocus;

              const recipe = buildRecipe(
                componentName,
                bulletResult.properties,
                states,
                currentFamily,
                "",
                bulletResult.sourceLine,
              );
              doc.spec.componentRecipes = [
                ...(doc.spec.componentRecipes ?? []),
                recipe,
              ];
              return;
            }
          }
        }
      }

      const para = item.children.find(
        (c): c is Paragraph => c.type === "paragraph",
      );
      if (!para) return;

      const pair = parseBoldPair(para);
      if (!pair) return;

      const line = nodeLine(item, 1, offset);
      const { base, states } = extractStates(pair.rest);

      const recipe = buildRecipe(pair.name, base, states, currentFamily, pair.rest, line);
      doc.spec.componentRecipes = [
        ...(doc.spec.componentRecipes ?? []),
        recipe,
      ];

      return;
    }

    // Process standalone paragraphs with bold name + inline property list
    // Only if the paragraph is NOT inside a list item (those are handled above)
    if (node.type === "paragraph") {
      if (parent && (parent.type === "listItem" || parent.type === "list")) return;

      const para = node as Paragraph;
      const pair = parseBoldPair(para);
      if (!pair) return;

      const kvProps = parseInlineKeyValues(pair.rest);
      if (Object.keys(kvProps).length === 0) return;

      const line = nodeLine(para, 1, offset);
      const { base, states } = extractStates(pair.rest);

      const recipe = buildRecipe(pair.name, base, states, currentFamily, pair.rest, line);
      doc.spec.componentRecipes = [
        ...(doc.spec.componentRecipes ?? []),
        recipe,
      ];
      return;
    }
  });
}

// ---------------------------------------------------------------------------
// Convenience wrapper
// ---------------------------------------------------------------------------

export function extractComponentsFromContent(content: string): DesignDocument {
  const doc: DesignDocument = {
    spec: {
      colors: {},
      typography: {},
      spacing: {},
      radii: {},
      layout: {},
      raw: {},
      colorTokens: [],
      typographyTokens: [],
      spacingTokens: [],
      radiusTokens: [],
      elevationTokens: [],
      surfaceTokens: [],
      layoutTokens: [],
      componentRecipes: [],
      gradientTokens: [],
    },
    diagnostics: [],
    detection: { score: 0, signals: [] },
    meta: {
      name: "",
      description: "",
      sourceLength: content.length,
    },
    _sourceContent: content,
  };

  extractComponents(doc);
  return doc;
}
