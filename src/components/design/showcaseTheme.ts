import type {
  ColorToken,
  ComponentRecipe,
  DesignDocument,
} from "@/parser/design";

type NyxVar = string;

function isOnVariant(n: string): boolean {
  const lower = n.toLowerCase();
  const normalized = lower.replace(/[-_]+/g, " ").trim();
  if (/^on\s/.test(normalized)) return true;
  if (/\bon\s/.test(normalized)) return true;
  if (/^on[-_]/.test(lower)) return true;
  if (/\bon[-_]/.test(lower)) return true;
  if (lower.includes("-on-") || lower.includes("_on_")) return true;
  if (normalized.endsWith(" on dark") || normalized.endsWith(" on light")) return true;
  if (/^text\son\s/.test(normalized)) return true;
  return false;
}

function combinedTokenText(token: ColorToken): string {
  const n = normalizeTokenName(token.name);
  const roleName = token.role ? normalizeTokenName(token.role) : "";
  const descName = token.description ? normalizeTokenName(token.description) : "";
  return `${n} ${roleName} ${descName}`.trim();
}

function isThemeAccentOnVariant(combined: string, isDarkTheme: boolean): boolean {
  const theme = isDarkTheme ? "dark" : "light";
  return new RegExp(`\\b(?:primary|accent|brand|action|link)\\s+on\\s+${theme}\\b`).test(combined);
}

function isThemeTextOnVariant(combined: string, isDarkTheme: boolean): boolean {
  const theme = isDarkTheme ? "dark" : "light";
  if (new RegExp(`\\b(?:text|body|ink|foreground|heading|head|muted|dim|caption|content)\\s+on\\s+${theme}\\b`).test(combined)) {
    return true;
  }
  return new RegExp(`^on\\s+${theme}\\b`).test(combined);
}

function shouldRejectOnVariantForVar(token: ColorToken, nyxVar: NyxVar, isDarkTheme: boolean): boolean {
  const n = normalizeTokenName(token.name);
  if (!isOnVariant(n)) return false;

  const combined = combinedTokenText(token);

  if (isSemanticAccent(nyxVar)) {
    return !isThemeAccentOnVariant(combined, isDarkTheme);
  }

  if (isTextHeadRole(nyxVar) || isTextBodyRole(nyxVar) || isTextMutedRole(nyxVar) || isTextDimRole(nyxVar)) {
    return !isThemeTextOnVariant(combined, isDarkTheme);
  }

  return true;
}

function normalizeTokenName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .trim();
}

const ACCENT_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /^(?:primary|accent|brand|action|link)$/, confidence: 100 },
  { pattern: /\b(?:primary|accent|brand|action|link)\b/, confidence: 80 },
  { pattern: /\b(?:ctas?|interactive)\b/, confidence: 60 },
];

const ACCENT_HOVER_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:primary[\s-]?focus|primary[\s-]?hover|accent[\s-]?hover|accent[\s-]?focus)\b/, confidence: 100 },
  { pattern: /\b(?:action[\s-]?hover|action[\s-]?focus|hovered[\s-]?accent|hovered[\s-]?primary)\b/, confidence: 90 },
  { pattern: /\b(?:component[\s-]?hover|component[\s-]?focus|interactive[\s-]?hover|interactive[\s-]?focus)\b/, confidence: 85 },
  { pattern: /\bhover\b.*\b(?:primary|accent|brand|action)\b/, confidence: 75 },
  { pattern: /\b(?:primary|accent|brand|action)\b.*\bhover\b/, confidence: 75 },
  { pattern: /\b(?:cta[\s-]?hover|link[\s-]?hover|button[\s-]?hover|btn[\s-]?hover)\b/, confidence: 70 },
];

const BG_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /^(?:background|canvas|page|app[\s-]?bg|body[\s-]?bg)$/, confidence: 100 },
  { pattern: /\b(?:page[\s-]?background|app[\s-]?background|body[\s-]?background|global[\s-]?background)\b/, confidence: 95 },
  { pattern: /\b(?:background|canvas|page[\s-]?bg)\b/, confidence: 80 },
  { pattern: /\b(?:base[\s-]?bg|app[\s-]?bg|body[\s-]?bg)\b/, confidence: 75 },
  { pattern: /\bbg\b/, confidence: 50 },
];

const SEMANTIC_TINT_BG_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:accent|primary|brand)[\s-]?(?:bg|background)\b/, confidence: 100 },
  { pattern: /\b(?:bg|background)[\s-]?(?:accent|primary|brand)\b/, confidence: 100 },
  { pattern: /\b(?:positive|success)[\s-]?(?:bg|background)\b/, confidence: 100 },
  { pattern: /\b(?:bg|background)[\s-]?(?:positive|success)\b/, confidence: 100 },
  { pattern: /\b(?:warning|caution)[\s-]?(?:bg|background)\b/, confidence: 100 },
  { pattern: /\b(?:bg|background)[\s-]?(?:warning|caution)\b/, confidence: 100 },
  { pattern: /\b(?:error|danger)[\s-]?(?:bg|background)\b/, confidence: 100 },
  { pattern: /\b(?:bg|background)[\s-]?(?:error|danger)\b/, confidence: 100 },
  { pattern: /\b(?:info|information|informative)[\s-]?(?:bg|background)\b/, confidence: 100 },
  { pattern: /\b(?:bg|background)[\s-]?(?:info|information|informative)\b/, confidence: 100 },
  { pattern: /\b(?:callout|note|alert|tip)[\s-]?(?:bg|background)\b/, confidence: 100 },
  { pattern: /\b(?:bg|background)[\s-]?(?:callout|note|alert|tip)\b/, confidence: 100 },
  { pattern: /\b(?:tag|badge|chip|pill)[\s-]?(?:bg|background)\b/, confidence: 100 },
  { pattern: /\b(?:bg|background)[\s-]?(?:tag|badge|chip|pill)\b/, confidence: 100 },
  { pattern: /\b(?:neutral|muted|subtle)[\s-]?(?:bg|background)\b/, confidence: 100 },
  { pattern: /\b(?:bg|background)[\s-]?(?:neutral|muted|subtle)\b/, confidence: 100 },
];

function isSemanticTintBg(token: ColorToken): boolean {
  const n = normalizeTokenName(token.name);
  const roleName = token.role ? normalizeTokenName(token.role) : "";
  const descName = token.description ? normalizeTokenName(token.description) : "";
  const combined = n + " " + roleName + " " + descName;
  for (const { pattern } of SEMANTIC_TINT_BG_KEYWORDS) {
    if (pattern.test(combined)) return true;
  }
  return false;
}

const SURFACE_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /^(?:surface|card|panel)$/, confidence: 100 },
  { pattern: /\b(?:surface|card|panel)\b/, confidence: 80 },
  { pattern: /\b(?:elevated[\s-]?surface|surface[\s-]?elevated)\b/, confidence: 85 },
  { pattern: /\b(?:default[\s-]?bg|app[\s-]?surface|window[\s-]?surface)\b/, confidence: 75 },
];

const TEXT_HEAD_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:text[\s-]?(?:primary|head|heading|title))\b/, confidence: 100 },
  { pattern: /\b(?:ink|foreground)\b/, confidence: 80 },
  { pattern: /\b(?:heading|headline|title)\b/, confidence: 60 },
];

const TEXT_BODY_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:text[\s-]?body|body[\s-]?text)\b/, confidence: 100 },
  { pattern: /\b(?:body|copy|paragraph)\b/, confidence: 70 },
];

const TEXT_MUTED_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:text[\s-]?(?:muted|secondary|subtle))\b/, confidence: 100 },
  { pattern: /\b(?:muted|secondary|subdued)\b/, confidence: 70 },
];

const TEXT_DIM_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:text[\s-]?(?:dim|tertiary|caption|tertiary[\s-]?text))\b/, confidence: 100 },
  { pattern: /\b(?:tertiary|caption|dim|faint)\b/, confidence: 70 },
];

const SEP_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:border|divider|hairline|separator|sep)\b/, confidence: 100 },
  { pattern: /\b(?:stroke|outline)\b/, confidence: 60 },
];

const POSITIVE_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:positive|success)\b/, confidence: 100 },
];

const POSITIVE_BG_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:positive|success)[\s-]?(?:bg|background)\b/, confidence: 100 },
  { pattern: /\b(?:bg|background)[\s-]?(?:positive|success)\b/, confidence: 100 },
];

const WARNING_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:warning|caution)\b/, confidence: 100 },
];

const WARNING_BG_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:warning|caution)[\s-]?(?:bg|background)\b/, confidence: 100 },
  { pattern: /\b(?:bg|background)[\s-]?(?:warning|caution)\b/, confidence: 100 },
];

const ERROR_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:error|danger)\b/, confidence: 100 },
];

const INFO_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:info|information|informative)\b/, confidence: 100 },
];

const ACCENT_BG_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:accent|primary|brand)[\s-]?(?:bg|background)\b/, confidence: 100 },
  { pattern: /\b(?:bg|background)[\s-]?(?:accent|primary|brand)\b/, confidence: 100 },
];

function isTextLikeToken(token: ColorToken): boolean {
  const n = normalizeTokenName(token.name);
  const role = token.role ? normalizeTokenName(token.role) : "";
  const desc = token.description ? normalizeTokenName(token.description) : "";
  const combined = n + " " + role + " " + desc;
  if (/\b(?:text|ink|foreground|copy|content|label)\b/.test(combined)) return true;
  if (role === "text" || role === "text-muted" || role === "text-dim" || role === "text-secondary" || role === "text-tertiary") return true;
  if (/\bon\b/.test(combined)) return true;
  return false;
}

function isPaletteAccentToken(token: ColorToken): boolean {
  const name = normalizeTokenName(token.name);
  const role = token.role ? normalizeTokenName(token.role) : "";
  const isTextLike = isTextLikeToken(token);
  if (/\b(?:secondary|tertiary|quaternary|quinary)\b/.test(name) && !isTextLike) return true;
  if (role === "accent" && /\b(?:secondary|tertiary|quaternary)\b/.test(name) && !isTextLike) return true;
  if (token.group === "Brand" && /\b(?:secondary|tertiary)\b/.test(name) && !isTextLike) return true;
  return false;
}

function luminanceOfToken(token: ColorToken): "light" | "dark" | "mid" | null {
  const c = parseColor(token.value);
  if (!c) return null;
  if (c.a < 0.5) return "mid";
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  if (lum >= 200) return "light";
  if (lum < 80) return "dark";
  return "mid";
}

function tokenLuminanceMatches(token: ColorToken, wantLight: boolean): boolean {
  const lum = luminanceOfToken(token);
  if (lum === null) return true;
  if (wantLight) return lum === "light" || lum === "mid";
  return lum === "dark" || lum === "mid";
}

function normalizeBorderValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/[{}<>;]/.test(trimmed)) return undefined;
  if (/(?:url|expression|javascript|vbscript)\s*\(/i.test(trimmed)) return undefined;
  if (/^(?:javascript|vbscript):/i.test(trimmed)) return undefined;
  const borderMatch = trimmed.match(/^(\d+(?:\.\d+)?(?:px|em|rem)?)\s+(solid|dashed|dotted)?\s*(.+)$/i);
  if (borderMatch) {
    const color = borderMatch[3]!.trim();
    if (parseColor(color)) return color;
  }
  if (parseColor(trimmed)) return trimmed;
  return trimmed;
}

function scoreToken(
  token: ColorToken,
  keywords: Array<{ pattern: RegExp; confidence: number }>,
  excludeOnVariants: boolean = false,
): number {
  const n = normalizeTokenName(token.name);
  if (excludeOnVariants && isOnVariant(n)) return 0;
  const roleName = token.role ? normalizeTokenName(token.role) : "";
  const descName = token.description ? normalizeTokenName(token.description) : "";
  let bestScore = 0;
  for (const { pattern, confidence } of keywords) {
    if (pattern.test(n)) bestScore = Math.max(bestScore, confidence);
    if (roleName && pattern.test(roleName)) bestScore = Math.max(bestScore, confidence - 5);
    if (descName && pattern.test(descName)) bestScore = Math.max(bestScore, confidence - 10);
  }
  return bestScore;
}

function pickBest(
  tokens: ColorToken[],
  keywords: Array<{ pattern: RegExp; confidence: number }>,
  excludeOnVariants: boolean = false,
  alreadyClaimed: Set<string> = new Set(),
): ColorToken | undefined {
  let best: ColorToken | undefined;
  let bestScore = 0;
  for (const token of tokens) {
    if (alreadyClaimed.has(token.name)) continue;
    const score = scoreToken(token, keywords, excludeOnVariants);
    if (score > bestScore) { bestScore = score; best = token; }
  }
  return bestScore >= 50 ? best : undefined;
}

function scoreTokenForVar(
  token: ColorToken,
  nyxVar: NyxVar,
  keywords: Array<{ pattern: RegExp; confidence: number }>,
  isDarkTheme: boolean,
): number {
  const n = normalizeTokenName(token.name);

  if (shouldRejectOnVariantForVar(token, nyxVar, isDarkTheme)) return 0;

  if (isSemanticAccent(nyxVar) && isPaletteAccentToken(token)) return 0;

  if (isTextMutedRole(nyxVar) && !isTextLikeToken(token) && isPaletteAccentToken(token)) return 0;

  if (isTextDimRole(nyxVar) && !isTextLikeToken(token) && isPaletteAccentToken(token)) return 0;

  if (isTextHeadRole(nyxVar) && !isTextLikeToken(token) && isPaletteAccentToken(token)) return 0;

  if (isTextBodyRole(nyxVar) && !isTextLikeToken(token) && isPaletteAccentToken(token)) return 0;

  if (isBgOrSurfaceVar(nyxVar)) {
    if (isSemanticTintBg(token)) return 0;

    const wantLight = !isDarkTheme;
    const color = parseColor(token.value);
    if (!isDarkTheme && color && color.a < 0.5) return 0;
    if (nyxVar === "--nyx-bg" && color && color.a < 0.9) return 0;
    if (!tokenLuminanceMatches(token, wantLight)) return 0;

    if (!isDarkTheme) {
      const combined = n + " " + (token.role ? normalizeTokenName(token.role) : "") + " " + (token.description ? normalizeTokenName(token.description) : "");
      if (/\bdark\b/.test(combined)) return 0;
      if (/\boverlay\b/.test(combined)) return 0;
    }
  }

  const roleName = token.role ? normalizeTokenName(token.role) : "";
  const descName = token.description ? normalizeTokenName(token.description) : "";

  let bestScore = 0;

  for (const { pattern, confidence } of keywords) {
    if (pattern.test(n)) {
      bestScore = Math.max(bestScore, confidence);
    }
    if (roleName && pattern.test(roleName)) {
      bestScore = Math.max(bestScore, confidence - 5);
    }
    if (descName && pattern.test(descName)) {
      bestScore = Math.max(bestScore, confidence - 10);
    }
  }

  const combined = n + " " + roleName + " " + descName;
  if (
    bestScore === 0 &&
    (isTextHeadRole(nyxVar) || isTextBodyRole(nyxVar)) &&
    isThemeTextOnVariant(combined, isDarkTheme)
  ) {
    bestScore = 65;
  }

  return bestScore;
}

function pickBestForVar(
  tokens: ColorToken[],
  nyxVar: NyxVar,
  keywords: Array<{ pattern: RegExp; confidence: number }>,
  isDarkTheme: boolean,
  exclude: Set<string> = new Set(),
): ColorToken | undefined {
  let best: ColorToken | undefined;
  let bestScore = 0;

  for (const token of tokens) {
    if (exclude.has(token.name)) continue;
    const score = scoreTokenForVar(token, nyxVar, keywords, isDarkTheme);
    if (score > bestScore) {
      bestScore = score;
      best = token;
    }
  }

  return bestScore >= 50 ? best : undefined;
}

function safeCssValue(value: unknown): string | undefined {
  const trimmed = cssScalarToString(value)?.trim();
  if (!trimmed) return undefined;
  if (/[{}<>;]/.test(trimmed)) return undefined;
  if (/(?:url|expression|javascript|vbscript)\s*\(/i.test(trimmed)) return undefined;
  if (/^(?:javascript|vbscript):/i.test(trimmed)) return undefined;
  return trimmed;
}

function cssScalarToString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function parseColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    const h = hex[1]!;
    if (h.length === 3) {
      return {
        r: parseInt(h[0]! + h[0], 16),
        g: parseInt(h[1]! + h[1], 16),
        b: parseInt(h[2]! + h[2], 16),
        a: 1,
      };
    }
    if (h.length === 4) {
      return {
        r: parseInt(h[0]! + h[0], 16),
        g: parseInt(h[1]! + h[1], 16),
        b: parseInt(h[2]! + h[2], 16),
        a: parseInt(h[3]! + h[3], 16) / 255,
      };
    }
    if (h.length === 6) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: 1,
      };
    }
    if (h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: parseInt(h.slice(6, 8), 16) / 255,
      };
    }
  }

  const rgb = value.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
  );
  if (rgb) {
    return {
      r: parseInt(rgb[1]!),
      g: parseInt(rgb[2]!),
      b: parseInt(rgb[3]!),
      a: rgb[4] !== undefined ? parseFloat(rgb[4]) : 1,
    };
  }

  return null;
}

function isColorDark(value: string): boolean | null {
  const c = parseColor(value);
  if (!c) return null;
  const luminance = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return luminance < 128;
}

function detectIsDarkTheme(vars: Map<string, string>): boolean {
  const bg = vars.get("--nyx-bg");
  if (bg) {
    const dark = isColorDark(bg);
    if (dark !== null) return dark;
  }
  const textHead = vars.get("--nyx-text-head");
  if (textHead) {
    const dark = isColorDark(textHead);
    if (dark !== null) return !dark;
  }
  const surface = vars.get("--nyx-surface");
  if (surface) {
    const dark = isColorDark(surface);
    if (dark !== null) return dark;
  }
  return true;
}

function invertColor(value: string): string {
  const c = parseColor(value);
  if (!c) return value;
  const r = 255 - c.r;
  const g = 255 - c.g;
  const b = 255 - c.b;
  if (c.a < 1) {
    return `rgba(${r},${g},${b},${c.a})`;
  }
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const INVERTIBLE_VARS = new Set([
  "--nyx-bg",
  "--nyx-surface",
  "--nyx-surface-elevated",
  "--nyx-sep",
  "--nyx-text-head",
  "--nyx-text-body",
  "--nyx-text-muted",
  "--nyx-text-dim",
  "--nyx-neutral-bg",
  "--nyx-neutral-text",
  "--nyx-tag-neutral-bg",
  "--nyx-callout-bg",
  "--nyx-callout-text",
  "--nyx-btn-primary-text",
  "--nyx-btn-secondary-hover",
  "--nyx-mobile-row-text",
  "--nyx-card-highlight-border",
  "--nyx-accent-bg",
  "--nyx-positive-bg",
  "--nyx-warning-bg",
  "--nyx-input-label",
  "--nyx-input-helper",
  "--nyx-input-placeholder",
]);

function invertThemeVars(
  vars: Map<string, string>,
  accentValue: string | undefined
): Map<string, string> {
  const inverted = new Map<string, string>();

  for (const [key, value] of vars) {
    if (INVERTIBLE_VARS.has(key)) {
      inverted.set(key, invertColor(value));
    } else if (key === "--nyx-accent" && accentValue) {
      inverted.set(key, accentValue);
    } else if (key === "--nyx-accent-hover" && accentValue) {
      inverted.set(key, accentValue);
    } else if (key === "--nyx-positive" || key === "--nyx-warning" || key === "--nyx-error" || key === "--nyx-info") {
      inverted.set(key, value);
    } else if (
      key.startsWith("--nyx-radius-") ||
      key === "--nyx-font-family"
    ) {
      inverted.set(key, value);
    } else if (key.endsWith("-size") || key.endsWith("-weight") || key.endsWith("-line") || key.endsWith("-track")) {
      inverted.set(key, value);
    }
  }

  return inverted;
}

function setSafeCssVar(vars: Map<string, string>, key: string, value: unknown): void {
  const safe = safeCssValue(value);
  if (safe) vars.set(key, safe);
}

function normalizeRadiusValue(value: string): string {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "none" || lower === "0" || lower === "zero") return "0px";
  if (/^0(\.0+)?px$/.test(lower)) return "0px";
  return trimmed;
}

function isZeroRadius(value: string): boolean {
  const normalized = normalizeRadiusValue(value);
  return normalized === "0px";
}

function mapRadiusToken(token: { name: string; value: string }): [string, string] | null {
  const n = token.name.toLowerCase();
  const v = normalizeRadiusValue(token.value);

  if (n === "all" || n === "global" || n === "base" || n === "default" || n === "radius-all")
    return [isZeroRadius(v) ? "--nyx-radius-global-zero" : "--nyx-radius-global", v];
  if (n.includes("card") || n.includes("lg") || n.includes("large") || n.includes("xl"))
    return ["--nyx-radius-card", v];
  if (n.includes("table") || n.includes("md") || n.includes("medium"))
    return ["--nyx-radius-table", v];
  if (n.includes("button") || n.includes("btn"))
    return ["--nyx-radius-btn", v];
  if (n.includes("input") || n.includes("field") || n.includes("sm") || n.includes("small"))
    return ["--nyx-radius-input", v];
  if (n.includes("badge") || n.includes("pill") || n.includes("full") || n.includes("round"))
    return ["--nyx-radius-badge", v];

  if (isZeroRadius(v) && (n === "none" || n === "default" || n === "base" || n === "all" || n === "global")) {
    return ["--nyx-radius-global-zero", v];
  }

  return null;
}

type ComponentFamily = "button" | "card" | "badge" | "chip" | "tag" | "input";

const FAMILY_PATTERNS: Array<{ family: ComponentFamily; pattern: RegExp }> = [
  { family: "button", pattern: /\b(?:button|btn)\b/i },
  { family: "card", pattern: /\b(?:card|tile|panel)\b/i },
  { family: "badge", pattern: /\b(?:badge)\b/i },
  { family: "chip", pattern: /\b(?:chip)\b/i },
  { family: "tag", pattern: /\b(?:tag)\b/i },
  { family: "input", pattern: /\b(?:input|field|search[-_]?input|text[-_]?field)\b/i },
];

function inferRecipeFamily(name: string, properties: Record<string, string>): ComponentFamily | undefined {
  const n = name.toLowerCase();
  const famProp = properties.family?.toLowerCase();
  if (famProp) {
    for (const { family, pattern } of FAMILY_PATTERNS) {
      if (pattern.test(famProp)) return family;
    }
  }
  for (const { family, pattern } of FAMILY_PATTERNS) {
    if (pattern.test(n)) return family;
  }
  return undefined;
}

function pickRecipeProp(props: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = props[key];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function resolveRecipeValue(value: string, doc: DesignDocument): string {
  if (!value.includes("{")) return value;
  const colors = doc.spec.colors ?? {};
  const radii = doc.spec.radii ?? {};
  const spacing = doc.spec.spacing ?? {};
  const typography = doc.spec.typography ?? {};
  const all: Record<string, string> = { ...colors, ...radii, ...spacing, ...typography };
  return value.replace(/\{([^}]+)\}/g, (_, ref: string) => {
    const trimmed = ref.trim();
    const dotIdx = trimmed.indexOf(".");
    if (dotIdx >= 0) {
      const group = trimmed.substring(0, dotIdx).toLowerCase();
      const name = trimmed.substring(dotIdx + 1);
      const groupMap: Record<string, Record<string, string>> = {
        colors, color: colors, radii, radius: radii, rounded: radii,
        spacing, typography,
      };
      const map = groupMap[group];
      if (map) {
        const direct = map[name];
        if (direct !== undefined) return direct;
        const lower = name.toLowerCase();
        for (const [k, v] of Object.entries(map)) {
          if (k.toLowerCase() === lower) return v;
        }
        const suffix = "-" + lower;
        for (const [k, v] of Object.entries(map)) {
          if (k.toLowerCase().endsWith(suffix)) return v;
        }
      }
    }
    const direct = all[trimmed];
    if (direct !== undefined) return direct;
    const lower = trimmed.toLowerCase();
    for (const [k, v] of Object.entries(all)) {
      if (k.toLowerCase() === lower) return v;
    }
    return `{${trimmed}}`;
  });
}

const SPECIALIZED_CARD_KEYWORDS: RegExp[] = [
  /\b(?:product[\s-]?tile|tile[\s-]?dark|tile[\s-]?light)\b/i,
  /\b(?:hero[\s-]?card|hero[\s-]?banner|hero[\s-]?section)\b/i,
  /\b(?:overlay|modal|dialog|popover)\b/i,
  /\b(?:feature[\s-]?card|feature[\s-]?block|frosted|glass[\s-]?card|glassmorphism)\b/i,
  /\b(?:quote|testimonial|review)\b/i,
  /\b(?:media[\s-]?card|photo[\s-]?card|gallery[\s-]?item|image[\s-]?card)\b/i,
  /\b(?:pricing|plan[\s-]?card|offer[\s-]?card|promo)\b/i,
  /\b(?:profile|avatar[\s-]?card|user[\s-]?card)\b/i,
  /\b(?:stat|metric|kpi|counter)\b/i,
  /\b(?:banner|announcement|notification[\s-]?card)\b/i,
  /\b(?:sidebar|nav[\s-]?card|menu[\s-]?card)\b/i,
  /\b(?:footer|header[\s-]?card)\b/i,
  /\b(?:dark[\s-]?card|light[\s-]?card)\b/i,
  /\b(?:environment|scene|backdrop)\b/i,
];

function isGenericCardRecipe(name: string, properties: Record<string, string>): boolean {
  const n = name.toLowerCase();
  const famProp = properties.family?.toLowerCase();
  const combined = n + " " + (famProp ?? "");

  for (const pattern of SPECIALIZED_CARD_KEYWORDS) {
    if (pattern.test(combined)) return false;
  }

  const genericKeywords = ["default", "base", "generic", "standard", "normal", "reader", "utility"];
  for (const kw of genericKeywords) {
    if (combined.includes(kw)) return true;
  }

  if (n === "card" || n === "tile" || n === "panel") return true;

  const simpleCardPatterns = [/^card$/, /^card[\s-]?\d*$/, /^tile$/, /^panel$/];
  for (const p of simpleCardPatterns) {
    if (p.test(n.trim())) return true;
  }

  return false;
}

function isPrimaryButtonRecipe(name: string, properties: Record<string, string>): boolean {
  const combined = normalizeTokenName(`${name} ${properties.family ?? ""} ${properties.role ?? ""}`);
  if (/\b(?:secondary|ghost|outline|utility|icon|link|pearl|circle|circular|nav)\b/.test(combined)) {
    return false;
  }
  if (/\b(?:primary|cta|action|submit|buy|purchase|checkout|hero)\b/.test(combined)) {
    return true;
  }
  return combined === "button" || combined === "btn" || /\bbutton\b/.test(combined);
}

function mapRecipeStyles(recipe: ComponentRecipe, doc: DesignDocument): [string, string][] {
  const pairs: [string, string][] = [];
  const props = recipe.properties;
  const family = inferRecipeFamily(recipe.name, props);

  const resolve = (v: string): string => resolveRecipeValue(v, doc);

  const radius = pickRecipeProp(props, ["borderRadius", "border-radius", "radius", "rounded"]);
  const background = pickRecipeProp(props, ["backgroundColor", "background-color", "background", "bg"]);
  const foreground = pickRecipeProp(props, ["textColor", "text-color", "foreground", "color", "text"]);
  const borderColor = pickRecipeProp(props, ["borderColor", "border-color", "border"]);
  const padding = pickRecipeProp(props, ["padding", "paddingX", "paddingY", "padding-x", "padding-y"]);
  const height = pickRecipeProp(props, ["height", "minHeight", "min-height"]);
  const hoverBg = pickRecipeProp(props, ["hoverBackgroundColor", "hover-background", "hover-color", "state-hover"]);
  const focusRing = pickRecipeProp(props, ["focusRing", "focus-ring", "focus-ring-color", "focusBorderColor", "focus-border-color"]);

  const addSafe = (key: string, raw: string | undefined): void => {
    if (!raw) return;
    const resolved = resolve(raw);
    const safe = safeCssValue(resolved);
    if (safe) pairs.push([key, safe]);
  };

  if (family === "button") {
    if (isPrimaryButtonRecipe(recipe.name, props)) {
      if (radius) addSafe("--nyx-radius-btn", radius);
      if (foreground) addSafe("--nyx-btn-primary-text", foreground);
      if (hoverBg) addSafe("--nyx-accent-hover", hoverBg);
    }
  }

  if (family === "card") {
    const isGeneric = isGenericCardRecipe(recipe.name, props);
    if (isGeneric) {
      if (radius) addSafe("--nyx-radius-card", radius);
      if (background) addSafe("--nyx-surface", background);
      if (padding) addSafe("--nyx-card-padding", padding);
      if (borderColor) {
        const resolved = resolve(borderColor);
        const normalized = normalizeBorderValue(resolved);
        if (normalized) pairs.push(["--nyx-card-highlight-border", normalized]);
      }
    }
  }

  if (family === "badge") {
    if (radius) addSafe("--nyx-radius-badge", radius);
  }

  if (family === "chip" || family === "tag") {
    if (radius) addSafe("--nyx-radius-tag", radius);
    if (family === "chip" && radius) addSafe("--nyx-radius-badge", radius);
  }

  if (family === "input") {
    if (background) addSafe("--nyx-input-bg", background);
    if (borderColor) {
      const resolved = resolve(borderColor);
      const normalized = normalizeBorderValue(resolved);
      if (normalized) pairs.push(["--nyx-input-border", normalized]);
    }
    if (focusRing) addSafe("--nyx-input-focus-ring", focusRing);
    if (radius) addSafe("--nyx-radius-input", radius);
    if (height) addSafe("--nyx-input-height", height);
    if (padding) addSafe("--nyx-input-padding", padding);

    const labelColor = pickRecipeProp(props, ["labelColor", "label-color", "label"]);
    const helperColor = pickRecipeProp(props, ["helperColor", "helper-color", "helper"]);
    const placeholderColor = pickRecipeProp(props, ["placeholderColor", "placeholder-color", "placeholder"]);
    const inputTextColor = pickRecipeProp(props, ["textColor", "text-color", "foreground", "color", "text"]);

    if (labelColor) addSafe("--nyx-input-label", labelColor);
    if (helperColor) addSafe("--nyx-input-helper", helperColor);
    if (placeholderColor) addSafe("--nyx-input-placeholder", placeholderColor);
    if (inputTextColor && !labelColor) addSafe("--nyx-input-label", inputTextColor);
    if (inputTextColor && !helperColor) addSafe("--nyx-input-helper", inputTextColor);
  }

  return pairs;
}

type TypographyRole = "display" | "heading" | "subheading" | "body" | "label" | "code";

type ParsedTypography = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
};

const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "cursive",
  "fantasy",
  "emoji",
  "math",
  "fangsong",
]);

const TYPOGRAPHY_ROLES: TypographyRole[] = [
  "display",
  "heading",
  "subheading",
  "body",
  "label",
  "code",
];

type TypographyEntry = {
  name: string;
  typography: ParsedTypography;
};

function extractFamilyFromValue(value: string): string | undefined {
  const json = parseTypographyJson(value);
  if (json) {
    const family = json.fontFamily;
    if (family) return family;
  }

  const familyMatch = value.match(/family\s*:\s*(.+)/i);
  if (familyMatch) {
    const raw = cleanFontFamilyText(familyMatch[1]!.replace(/;.*$/, ""));
    if (raw) return raw;
  }

  return undefined;
}

function cleanFontFamilyText(value: string): string | undefined {
  const clean = value
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(?:google\s+fonts?\s+)?import(?:\s+required)?\b/gi, "")
    .replace(/\brequired\b/gi, "")
    .trim()
    .replace(/,$/, "");
  if (!clean || /\d+(?:\.\d+)?(?:px|rem|em|pt)/i.test(clean)) return undefined;
  return clean;
}

function findFontFamily(doc: DesignDocument): string | undefined {
  const tokens = doc.spec.typographyTokens ?? [];

  for (const token of tokens) {
    const n = token.name.toLowerCase();
    if (n.includes("font") && n.includes("family")) {
      const family = extractFamilyFromValue(token.value) ?? cleanFontFamilyText(token.value);
      if (family) return family;
    }
  }

  for (const token of tokens) {
    const fromValue = extractFamilyFromValue(token.value);
    if (fromValue) return fromValue;
  }

  const details = doc.spec.typographyDetails ?? {};
  for (const detail of Object.values(details)) {
    const family = detail.fontFamily || detail["font-family"];
    if (family) return family;
  }

  return undefined;
}

function getTypography(doc: DesignDocument, token: { name: string; value: string }): ParsedTypography {
  const details = doc.spec.typographyDetails?.[token.name];
  if (details) return typographyFromDetails(details);
  return parseTypoValue(token.value);
}

function typographyFromDetails(details: Record<string, unknown>): ParsedTypography {
  return {
    fontFamily: pickString(details, ["fontFamily", "font-family"]),
    fontSize: parseCssNumber(pickCssScalar(details, ["fontSize", "font-size"])),
    fontWeight: pickCssScalar(details, ["fontWeight", "font-weight"]),
    lineHeight: pickCssScalar(details, ["lineHeight", "line-height"]),
    letterSpacing: pickCssScalar(details, ["letterSpacing", "letter-spacing"]),
  };
}

function parseTypoValue(value: string): ParsedTypography {
  const fromJson = parseTypographyJson(value);
  if (fromJson) return fromJson;

  const typography: ParsedTypography = {};
  const sizeMatch = value.match(/(\d+(?:\.\d+)?)(px|rem|em|pt)(?:\/([\d.]+(?:[a-z%]+)?))?/i);
  if (sizeMatch) {
    typography.fontSize = Number(sizeMatch[1]);
    if (sizeMatch[3]) typography.lineHeight = sizeMatch[3];
    const beforeSize = value.slice(0, sizeMatch.index).trim();
    const shorthandFamily = extractShorthandFamily(beforeSize);
    if (shorthandFamily) typography.fontFamily = shorthandFamily;
  }

  const weightMatch = value.match(/\b(100|200|300|400|500|600|700|800|900|normal|bold|bolder|lighter|medium|semibold)\b/i);
  if (weightMatch) typography.fontWeight = normalizeWeight(weightMatch[1]!);

  const familyMatch = value.match(/family\s*:\s*([^;]+)/i);
  if (familyMatch) typography.fontFamily = familyMatch[1]!.trim();

  const lineHeightMatch = value.match(/(?:line-height|line height)\D*([\d.]+(?:[a-z%]+)?)/i);
  if (!typography.lineHeight && lineHeightMatch) typography.lineHeight = lineHeightMatch[1];

  const letterSpacingMatch = value.match(/(?:letter-spacing|letter spacing)\D*(-?[\d.]+(?:px|em|rem)?)/i);
  if (letterSpacingMatch) typography.letterSpacing = letterSpacingMatch[1];

  return typography;
}

function extractShorthandFamily(value: string): string | undefined {
  const clean = value.replace(/,$/, "").trim();
  if (!clean || clean.includes(":")) return undefined;
  if (/^(?:family|font-family|size|font-size|text|weight|font-weight)$/i.test(clean)) {
    return undefined;
  }
  return clean;
}

function parseTypographyJson(value: string): ParsedTypography | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return typographyFromDetails(parsed as Record<string, unknown>);
  } catch {
    return undefined;
  }
}

function parseCssNumber(value: unknown): number | undefined {
  const text = cssScalarToString(value);
  const match = text?.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function normalizeWeight(value: string): string {
  const lower = value.toLowerCase();
  if (lower === "medium") return "500";
  if (lower === "semibold") return "600";
  return value;
}

function pickString(properties: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function pickCssScalar(properties: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = cssScalarToString(properties[key]);
    if (value) return value;
  }
  return undefined;
}

function isSerifFamily(family: string): boolean {
  return /\bserif\b/i.test(family) && !/\bsans-serif\b/i.test(family);
}

function isMonoFamily(family: string): boolean {
  return /\b(?:mono|monospace|code)\b/i.test(family);
}

function roleMatches(name: string, role: TypographyRole): boolean {
  const n = name.toLowerCase();
  switch (role) {
    case "display":
      return /display|hero|headline-lg|title-xl/.test(n);
    case "heading":
      return /heading|headline|title|h[1-3]/.test(n) && !/sub|caption|label|display|hero/.test(n);
    case "subheading":
      return /subhead|subtitle|subheading|callout|title-large/.test(n);
    case "body":
      return /body|paragraph|copy|content|text-body|default/.test(n);
    case "label":
      return /label|caption|overline|eyebrow|small|meta|badge|tag|button|control/.test(n);
    case "code":
      return /code|mono|monospace/.test(n);
  }
}

function pickTypographyRole(
  entries: TypographyEntry[],
  role: TypographyRole,
): ParsedTypography | undefined {
  const candidates = entries.filter((entry) => roleMatches(entry.name, role));
  if (candidates.length === 0) return undefined;

  if (role === "display") return pickBySize(candidates, "largest");
  if (role === "label") return pickBySize(candidates, "smallest");
  if (role === "body") return pickBodyCandidate(candidates);
  return pickBySize(candidates, "heading") ?? candidates[0]?.typography;
}

function pickBySize(
  entries: TypographyEntry[],
  kind: "largest" | "heading" | "subheading" | "body" | "smallest",
): ParsedTypography | undefined {
  const sized = entries
    .filter((entry) => entry.typography.fontSize !== undefined)
    .sort((a, b) => (a.typography.fontSize ?? 0) - (b.typography.fontSize ?? 0));

  if (sized.length === 0) return undefined;

  if (kind === "largest") return sized[sized.length - 1]?.typography;
  if (kind === "smallest") return sized[0]?.typography;

  const ranges: Record<"heading" | "subheading" | "body", [number, number]> = {
    heading: [20, 44],
    subheading: [17, 30],
    body: [14, 19],
  };
  const [min, max] = ranges[kind];
  return sized.find((entry) => {
    const size = entry.typography.fontSize ?? 0;
    return size >= min && size <= max;
  })?.typography;
}

function pickBodyCandidate(entries: TypographyEntry[]): ParsedTypography | undefined {
  const exact = entries.find((entry) => {
    const normalized = entry.name.toLowerCase().replace(/[-_]+/g, " ").trim();
    return normalized === "body" || normalized === "text body";
  });
  if (exact) return exact.typography;

  const explicit = entries.find((entry) => /(^|[-_\s])body($|[-_\s])|text-body/i.test(entry.name));
  if (explicit) return explicit.typography;
  return pickBySize(entries, "body") ?? entries[0]?.typography;
}

function mergeTypography(
  base: ParsedTypography,
  override: ParsedTypography | undefined,
): ParsedTypography {
  return {
    ...base,
    ...override,
    fontFamily: override?.fontFamily ?? base.fontFamily,
  };
}

function collectFontFamilies(doc: DesignDocument): {
  body?: string;
  display?: string;
  code?: string;
} {
  const families: string[] = [];

  for (const token of doc.spec.typographyTokens ?? []) {
    const n = token.name.toLowerCase();
    if (!n.includes("font") && !n.includes("family")) continue;
    const family = extractFamilyFromValue(token.value) ?? cleanFontFamilyText(token.value);
    if (family && !families.some((existing) => existing.toLowerCase() === family.toLowerCase())) {
      families.push(family);
    }
  }

  for (const detail of Object.values(doc.spec.typographyDetails ?? {})) {
    const family = detail.fontFamily || detail["font-family"];
    if (family && !families.some((existing) => existing.toLowerCase() === family.toLowerCase())) {
      families.push(family);
    }
  }

  const serif = families.find(isSerifFamily);
  const mono = families.find(isMonoFamily);
  const sans = families.find((family) => !isSerifFamily(family) && !isMonoFamily(family));

  return {
    body: sans ?? serif ?? families[0],
    display: serif ?? sans ?? families[0],
    code: mono,
  };
}

function applyRoleFamilies(
  theme: Partial<Record<TypographyRole, ParsedTypography>>,
  families: { body?: string; display?: string; code?: string },
): void {
  const bodyFamily = families.body;
  const displayFamily = families.display ?? bodyFamily;

  if (displayFamily) {
    for (const role of ["display", "heading", "subheading"] as const) {
      theme[role] = mergeTypography({ fontFamily: displayFamily }, theme[role]);
    }
  }

  if (bodyFamily) {
    for (const role of ["body", "label"] as const) {
      theme[role] = mergeTypography({ fontFamily: bodyFamily }, theme[role]);
    }
  }

  if (families.code) {
    theme.code = mergeTypography({ fontFamily: families.code }, theme.code);
  }
}

function deriveTypographyTheme(doc: DesignDocument): Partial<Record<TypographyRole, ParsedTypography>> {
  const entries = (doc.spec.typographyTokens ?? []).map((token) => ({
    name: token.name,
    typography: getTypography(doc, token),
  }));
  const families = collectFontFamilies(doc);

  const theme: Partial<Record<TypographyRole, ParsedTypography>> = {
    display: pickTypographyRole(entries, "display"),
    heading: pickTypographyRole(entries, "heading"),
    subheading: pickTypographyRole(entries, "subheading"),
    body: pickTypographyRole(entries, "body"),
    label: pickTypographyRole(entries, "label"),
    code: pickTypographyRole(entries, "code"),
  };

  theme.display ??= pickBySize(entries, "largest");
  theme.heading ??= pickBySize(entries, "heading");
  theme.subheading ??= pickBySize(entries, "subheading");
  theme.body ??= pickBySize(entries, "body");
  theme.label ??= pickBySize(entries, "smallest");

  applyRoleFamilies(theme, families);

  return theme;
}

function inferFontGeneric(
  family: string | undefined,
  fallback: "sans-serif" | "serif" | "monospace",
): "sans-serif" | "serif" | "monospace" {
  if (!family) return fallback;
  if (isMonoFamily(family)) return "monospace";
  if (isSerifLikeFamily(family)) return "serif";
  return fallback;
}

function isSerifLikeFamily(family: string): boolean {
  if (isSerifFamily(family)) return true;
  return /\b(?:garamond|georgia|times|merriweather|lora|playfair|baskerville|crimson|bodoni|didot|signifier|recoleta|serif)\b/i.test(
    family,
  );
}

function splitFontFamilyStack(familyStack: string): string[] {
  const families: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of familyStack) {
    if ((char === '"' || char === "'") && quote === null) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = null;
      continue;
    }
    if (char === "," && quote === null) {
      const family = current.trim();
      if (family) families.push(family);
      current = "";
      continue;
    }
    current += char;
  }

  const family = current.trim();
  if (family) families.push(family);
  return families;
}

function hasTerminalFontFallback(familyStack: string): boolean {
  return splitFontFamilyStack(familyStack).some((family) => {
    const normalized = family.toLowerCase();
    return (
      GENERIC_FONT_FAMILIES.has(normalized) ||
      normalized === "-apple-system" ||
      normalized === "blinkmacsystemfont" ||
      normalized === "system-ui" ||
      normalized.startsWith("ui-")
    );
  });
}

function extractPrimaryFontFamilyName(familyStack: string | undefined): string | undefined {
  const safe = safeCssValue(familyStack);
  if (!safe) return undefined;

  const primary = splitFontFamilyStack(safe)[0];
  return sanitizeFontFamilyName(primary);
}

function sanitizeFontFamilyName(family: string | undefined): string | undefined {
  const cleaned = family
    ?.replace(/^["']|["']$/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > 80) return undefined;
  if (!/^[\p{L}\p{N} ._-]+$/u.test(cleaned)) return undefined;
  if (isGenericFontFamily(cleaned)) return undefined;
  return cleaned;
}

function isGenericFontFamily(family: string): boolean {
  return GENERIC_FONT_FAMILIES.has(family.toLowerCase());
}

function quoteFontFamily(family: string): string {
  return `"${family.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function withFontFallback(
  family: string | undefined,
  generic: "sans-serif" | "serif" | "monospace",
): string | undefined {
  const safe = safeCssValue(family);
  if (!safe) return undefined;

  if (hasTerminalFontFallback(safe)) {
    return safe;
  }

  const primary = extractPrimaryFontFamilyName(safe);
  return `${safe}, ${similarFontFallbackStack(primary, generic)}`;
}

function similarFontFallbackStack(
  primary: string | undefined,
  generic: "sans-serif" | "serif" | "monospace",
): string {
  if (generic === "monospace") return `"SF Mono", "Cascadia Code", Consolas, monospace`;
  if (generic === "serif") return `Georgia, "Times New Roman", serif`;

  if (primary && /\b(?:poppins|montserrat|outfit|sora|space grotesk|dm sans|general sans|sohne|inter)\b/i.test(primary)) {
    return `"Aptos Display", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif`;
  }

  if (primary && /\b(?:nunito|quicksand|rounded|m plus|comfortaa)\b/i.test(primary)) {
    return `"Segoe UI", Aptos, -apple-system, BlinkMacSystemFont, sans-serif`;
  }

  return `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
}

function clampPageFontSize(role: TypographyRole, value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const ranges: Record<TypographyRole, [number, number]> = {
    display: [38, 56],
    heading: [24, 40],
    subheading: [18, 28],
    body: [14, 18],
    label: [11, 13],
    code: [12, 15],
  };
  const [min, max] = ranges[role];
  return Math.min(max, Math.max(min, value));
}

function formatPx(value: number | undefined): string | undefined {
  return value === undefined ? undefined : `${value}px`;
}

function addTypographyRoleVars(
  vars: Map<string, string>,
  role: TypographyRole,
  typography: ParsedTypography,
): void {
  const prefix = `--nyx-${role}`;
  const family = withFontFallback(
    typography.fontFamily,
    inferFontGeneric(typography.fontFamily, role === "code" ? "monospace" : "sans-serif"),
  );
  setSafeCssVar(vars, `--nyx-font-${role}`, family);
  setSafeCssVar(vars, `${prefix}-size`, formatPx(clampPageFontSize(role, typography.fontSize)));
  setSafeCssVar(vars, `${prefix}-weight`, typography.fontWeight);
  setSafeCssVar(vars, `${prefix}-line`, typography.lineHeight);
  setSafeCssVar(vars, `${prefix}-track`, typography.letterSpacing);
}

function buildTypographyVars(doc: DesignDocument): Map<string, string> {
  const vars = new Map<string, string>();
  const theme = deriveTypographyTheme(doc);

  for (const role of TYPOGRAPHY_ROLES) {
    const typography = theme[role];
    if (!typography) continue;
    addTypographyRoleVars(vars, role, typography);
  }

  const bodyFamily = theme.body?.fontFamily ?? findFontFamily(doc);
  const family = withFontFallback(bodyFamily, inferFontGeneric(bodyFamily, "sans-serif"));
  if (family) {
    vars.set("--nyx-font-family", family);
    if (!vars.has("--nyx-font-body")) vars.set("--nyx-font-body", family);
  }

  const headingFamily =
    theme.heading?.fontFamily ??
    theme.display?.fontFamily ??
    theme.body?.fontFamily ??
    bodyFamily;
  const headingStack = withFontFallback(headingFamily, inferFontGeneric(headingFamily, "sans-serif"));
  if (headingStack) {
    if (!vars.has("--nyx-font-heading")) vars.set("--nyx-font-heading", headingStack);
    if (!vars.has("--nyx-font-display")) vars.set("--nyx-font-display", headingStack);
    if (!vars.has("--nyx-font-subheading")) vars.set("--nyx-font-subheading", headingStack);
  }

  return vars;
}

function fillDerivedVars(
  vars: Map<string, string>,
  accentValue: string | undefined,
  isDark: boolean,
): void {
  const accent = accentValue || vars.get("--nyx-accent") || "#38bdf8";
  const accentRgb = parseColor(accent);

  if (!vars.has("--nyx-neutral-bg")) {
    vars.set("--nyx-neutral-bg", isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)");
  }
  if (!vars.has("--nyx-neutral-text")) {
    vars.set("--nyx-neutral-text", isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)");
  }
  if (!vars.has("--nyx-tag-neutral-bg")) {
    vars.set("--nyx-tag-neutral-bg", isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)");
  }
  if (!vars.has("--nyx-callout-bg")) {
    if (accentRgb) {
      vars.set("--nyx-callout-bg", `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.08)`);
    } else {
      vars.set("--nyx-callout-bg", "rgba(56,189,248,0.08)");
    }
  }
  if (!vars.has("--nyx-callout-text")) {
    vars.set("--nyx-callout-text", isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)");
  }
  if (!vars.has("--nyx-btn-primary-text")) {
    vars.set("--nyx-btn-primary-text", isDark ? "#000" : "#fff");
  }
  if (!vars.has("--nyx-btn-secondary-hover")) {
    vars.set("--nyx-btn-secondary-hover", isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)");
  }
  if (!vars.has("--nyx-mobile-row-text")) {
    vars.set("--nyx-mobile-row-text", isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)");
  }
  if (!vars.has("--nyx-card-highlight-border")) {
    if (accentRgb) {
      vars.set("--nyx-card-highlight-border", `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.2)`);
    } else {
      vars.set("--nyx-card-highlight-border", "rgba(56,189,248,0.2)");
    }
  }
  if (!vars.has("--nyx-accent-bg")) {
    if (accentRgb) {
      vars.set("--nyx-accent-bg", `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.15)`);
    } else {
      vars.set("--nyx-accent-bg", "rgba(56,189,248,0.15)");
    }
  }
  if (!vars.has("--nyx-positive-bg")) {
    vars.set("--nyx-positive-bg", "rgba(34,197,94,0.1)");
  }
  if (!vars.has("--nyx-warning-bg")) {
    vars.set("--nyx-warning-bg", "rgba(234,179,8,0.1)");
  }
  if (!vars.has("--nyx-surface-elevated")) {
    vars.set("--nyx-surface-elevated", isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)");
  }
  if (!vars.has("--nyx-sep")) {
    vars.set("--nyx-sep", isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)");
  }
  if (!vars.has("--nyx-input-label")) {
    vars.set("--nyx-input-label", isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)");
  }
  if (!vars.has("--nyx-input-helper")) {
    vars.set("--nyx-input-helper", isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)");
  }
  if (!vars.has("--nyx-input-placeholder")) {
    vars.set("--nyx-input-placeholder", isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.35)");
  }
}

const COLOR_MAPPINGS: Array<{
  nyxVar: NyxVar;
  keywords: Array<{ pattern: RegExp; confidence: number }>;
  excludeOnVariants: boolean;
}> = [
  { nyxVar: "--nyx-accent", keywords: ACCENT_KEYWORDS, excludeOnVariants: true },
  { nyxVar: "--nyx-accent-hover", keywords: ACCENT_HOVER_KEYWORDS, excludeOnVariants: true },
  { nyxVar: "--nyx-accent-bg", keywords: ACCENT_BG_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-bg", keywords: BG_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-surface", keywords: SURFACE_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-text-head", keywords: TEXT_HEAD_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-text-body", keywords: TEXT_BODY_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-text-muted", keywords: TEXT_MUTED_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-text-dim", keywords: TEXT_DIM_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-sep", keywords: SEP_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-positive-bg", keywords: POSITIVE_BG_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-positive", keywords: POSITIVE_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-warning-bg", keywords: WARNING_BG_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-warning", keywords: WARNING_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-error", keywords: ERROR_KEYWORDS, excludeOnVariants: false },
  { nyxVar: "--nyx-info", keywords: INFO_KEYWORDS, excludeOnVariants: false },
];

const DARK_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:dark[\s-]?surface|surface[\s-]?dark|on[\s-]?dark)\b/, confidence: 100 },
  { pattern: /\bdark[\s-]?(?:bg|background|canvas|page|mode|theme)\b/, confidence: 95 },
  { pattern: /\b(?:bg|background|canvas|page|surface)[\s-]?dark\b/, confidence: 95 },
  { pattern: /\btext[\s-]?on[\s-]?dark\b/, confidence: 100 },
  { pattern: /\bprimary[\s-]?on[\s-]?dark\b/, confidence: 100 },
  { pattern: /\bdark[\s-]?(?:text|ink|foreground|heading|body|muted|dim|border|sep)\b/, confidence: 90 },
  { pattern: /\b(?:text|ink|foreground|heading|body|muted|dim|border|sep)[\s-]?dark\b/, confidence: 90 },
  { pattern: /\bdark[\s-]?(?:accent|brand|primary|hover|focus)\b/, confidence: 85 },
  { pattern: /\b(?:accent|hover|focus)[\s-]?dark\b/, confidence: 85 },
];

const LIGHT_KEYWORDS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\b(?:light[\s-]?surface|surface[\s-]?light|on[\s-]?light)\b/, confidence: 100 },
  { pattern: /\blight[\s-]?(?:bg|background|canvas|page|mode|theme)\b/, confidence: 95 },
  { pattern: /\b(?:bg|background|canvas|page|surface)[\s-]?light\b/, confidence: 95 },
  { pattern: /\btext[\s-]?on[\s-]?light\b/, confidence: 100 },
  { pattern: /\bprimary[\s-]?on[\s-]?light\b/, confidence: 100 },
  { pattern: /\blight[\s-]?(?:text|ink|foreground|heading|body|muted|dim|border|sep)\b/, confidence: 90 },
  { pattern: /\b(?:text|ink|foreground|heading|body|muted|dim|border|sep)[\s-]?light\b/, confidence: 90 },
  { pattern: /\blight[\s-]?(?:accent|brand|primary|hover|focus)\b/, confidence: 85 },
  { pattern: /\b(?:accent|hover|focus)[\s-]?light\b/, confidence: 85 },
];

type DarkLightAffinity = "dark" | "light" | "shared";

function classifyTokenAffinity(token: ColorToken): DarkLightAffinity {
  const n = normalizeTokenName(token.name);
  const roleName = token.role ? normalizeTokenName(token.role) : "";
  const descName = token.description ? normalizeTokenName(token.description) : "";

  const combined = n + " " + roleName + " " + descName;

  let darkScore = 0;
  let lightScore = 0;

  for (const { pattern, confidence } of DARK_KEYWORDS) {
    if (pattern.test(combined)) darkScore = Math.max(darkScore, confidence);
  }
  for (const { pattern, confidence } of LIGHT_KEYWORDS) {
    if (pattern.test(combined)) lightScore = Math.max(lightScore, confidence);
  }

  if (darkScore >= 80 && lightScore < 80) return "dark";
  if (lightScore >= 80 && darkScore < 80) return "light";
  return "shared";
}

function isTextMutedRole(nyxVar: string): boolean {
  return nyxVar === "--nyx-text-muted";
}

function isTextDimRole(nyxVar: string): boolean {
  return nyxVar === "--nyx-text-dim";
}

function isTextHeadRole(nyxVar: string): boolean {
  return nyxVar === "--nyx-text-head";
}

function isTextBodyRole(nyxVar: string): boolean {
  return nyxVar === "--nyx-text-body";
}

function isBgOrSurfaceVar(nyxVar: string): boolean {
  return nyxVar === "--nyx-bg" || nyxVar === "--nyx-surface";
}

function isSemanticAccent(nyxVar: string): boolean {
  return nyxVar === "--nyx-accent" || nyxVar === "--nyx-accent-hover";
}

function darkenColorConservative(value: string, mode: "bg" | "text" | "sep" | "surface"): string {
  const c = parseColor(value);
  if (!c) return value;
  if (mode === "bg" || mode === "surface") {
    const factor = mode === "bg" ? 0.12 : 0.08;
    const r = Math.round(c.r * factor);
    const g = Math.round(c.g * factor);
    const b = Math.round(c.b * factor);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  if (mode === "text") {
    const r = Math.min(255, Math.round(c.r + (255 - c.r) * 0.85));
    const g = Math.min(255, Math.round(c.g + (255 - c.g) * 0.85));
    const b = Math.min(255, Math.round(c.b + (255 - c.b) * 0.85));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  if (mode === "sep") {
    const r = Math.round(c.r * 0.25 + 255 * 0.06);
    const g = Math.round(c.g * 0.25 + 255 * 0.06);
    const b = Math.round(c.b * 0.25 + 255 * 0.06);
    return `rgba(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)},0.15)`;
  }
  return value;
}

function lightenColorConservative(value: string, mode: "bg" | "text" | "sep" | "surface"): string {
  const c = parseColor(value);
  if (!c) return value;
  if (mode === "bg" || mode === "surface") {
    const factor = mode === "surface" ? 1.0 : 0.97;
    const r = Math.min(255, Math.round(c.r + (255 - c.r) * factor));
    const g = Math.min(255, Math.round(c.g + (255 - c.g) * factor));
    const b = Math.min(255, Math.round(c.b + (255 - c.b) * factor));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  if (mode === "text") {
    const factor = 0.12;
    const r = Math.round(c.r * (1 - factor));
    const g = Math.round(c.g * (1 - factor));
    const b = Math.round(c.b * (1 - factor));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  if (mode === "sep") {
    const factor = 0.1;
    const r = Math.round(c.r * (1 - factor));
    const g = Math.round(c.g * (1 - factor));
    const b = Math.round(c.b * (1 - factor));
    return `#${Math.max(0, r).toString(16).padStart(2, "0")}${Math.max(0, g).toString(16).padStart(2, "0")}${Math.max(0, b).toString(16).padStart(2, "0")}`;
  }
  return value;
}

function deriveOppositeVar(
  nyxVar: string,
  lightValue: string,
  darkMode: boolean,
): string | undefined {
  if (isSemanticAccent(nyxVar)) return undefined;
  if (nyxVar.startsWith("--nyx-radius-") || nyxVar === "--nyx-font-family") return undefined;
  if (nyxVar.endsWith("-size") || nyxVar.endsWith("-weight") || nyxVar.endsWith("-line") || nyxVar.endsWith("-track")) return undefined;

  const darkSensitiveVars = new Set([
    "--nyx-bg", "--nyx-surface", "--nyx-surface-elevated",
    "--nyx-text-head", "--nyx-text-body", "--nyx-text-muted", "--nyx-text-dim",
    "--nyx-sep", "--nyx-neutral-bg", "--nyx-neutral-text",
    "--nyx-tag-neutral-bg", "--nyx-callout-text",
    "--nyx-btn-primary-text", "--nyx-btn-secondary-hover", "--nyx-mobile-row-text",
    "--nyx-input-bg", "--nyx-input-border", "--nyx-input-focus-ring",
    "--nyx-input-label", "--nyx-input-helper", "--nyx-input-placeholder",
  ]);

  if (!darkSensitiveVars.has(nyxVar)) return undefined;

  if (darkMode) {
    if (nyxVar === "--nyx-bg" || nyxVar === "--nyx-surface") return darkenColorConservative(lightValue, nyxVar === "--nyx-bg" ? "bg" : "surface");
    if (nyxVar === "--nyx-surface-elevated") return "rgba(255,255,255,0.05)";
    if (nyxVar === "--nyx-text-head" || nyxVar === "--nyx-text-body") return darkenColorConservative(lightValue, "text");
    if (nyxVar === "--nyx-text-muted") return "rgba(255,255,255,0.6)";
    if (nyxVar === "--nyx-text-dim") return "rgba(255,255,255,0.35)";
    if (nyxVar === "--nyx-sep") return "rgba(255,255,255,0.06)";
    if (nyxVar === "--nyx-neutral-bg") return "rgba(255,255,255,0.1)";
    if (nyxVar === "--nyx-neutral-text") return "rgba(255,255,255,0.6)";
    if (nyxVar === "--nyx-tag-neutral-bg") return "rgba(255,255,255,0.08)";
    if (nyxVar === "--nyx-callout-text") return "rgba(255,255,255,0.8)";
    if (nyxVar === "--nyx-btn-primary-text") return "#000";
    if (nyxVar === "--nyx-btn-secondary-hover") return "rgba(255,255,255,0.08)";
    if (nyxVar === "--nyx-mobile-row-text") return "rgba(255,255,255,0.6)";
    if (nyxVar === "--nyx-input-bg") return darkenColorConservative(lightValue, "surface");
    if (nyxVar === "--nyx-input-border") return "rgba(255,255,255,0.12)";
    if (nyxVar === "--nyx-input-focus-ring") return lightValue;
    if (nyxVar === "--nyx-input-label") return "rgba(255,255,255,0.7)";
    if (nyxVar === "--nyx-input-helper") return "rgba(255,255,255,0.45)";
    if (nyxVar === "--nyx-input-placeholder") return "rgba(255,255,255,0.3)";
  } else {
    if (nyxVar === "--nyx-bg" || nyxVar === "--nyx-surface") return lightenColorConservative(lightValue, nyxVar === "--nyx-bg" ? "bg" : "surface");
    if (nyxVar === "--nyx-surface-elevated") return "rgba(0,0,0,0.04)";
    if (nyxVar === "--nyx-text-head" || nyxVar === "--nyx-text-body") return lightenColorConservative(lightValue, "text");
    if (nyxVar === "--nyx-text-muted") return "rgba(0,0,0,0.6)";
    if (nyxVar === "--nyx-text-dim") return "rgba(0,0,0,0.35)";
    if (nyxVar === "--nyx-sep") return "rgba(0,0,0,0.08)";
    if (nyxVar === "--nyx-neutral-bg") return "rgba(0,0,0,0.08)";
    if (nyxVar === "--nyx-neutral-text") return "rgba(0,0,0,0.6)";
    if (nyxVar === "--nyx-tag-neutral-bg") return "rgba(0,0,0,0.06)";
    if (nyxVar === "--nyx-callout-text") return "rgba(0,0,0,0.7)";
    if (nyxVar === "--nyx-btn-primary-text") return "#fff";
    if (nyxVar === "--nyx-btn-secondary-hover") return "rgba(0,0,0,0.06)";
    if (nyxVar === "--nyx-mobile-row-text") return "rgba(0,0,0,0.6)";
    if (nyxVar === "--nyx-input-bg") return lightenColorConservative(lightValue, "surface");
    if (nyxVar === "--nyx-input-border") return "rgba(0,0,0,0.12)";
    if (nyxVar === "--nyx-input-focus-ring") return lightValue;
    if (nyxVar === "--nyx-input-label") return "rgba(0,0,0,0.65)";
    if (nyxVar === "--nyx-input-helper") return "rgba(0,0,0,0.45)";
    if (nyxVar === "--nyx-input-placeholder") return "rgba(0,0,0,0.35)";
  }
  return undefined;
}

function pickAccentHoverFromTokens(
  colorTokens: ColorToken[],
  accentValue: string | undefined,
  claimed: Set<string>,
): string | undefined {
  for (const token of colorTokens) {
    if (claimed.has(token.name)) continue;
    const score = scoreToken(token, ACCENT_HOVER_KEYWORDS, true);
    if (score >= 50) {
      const safe = safeCssValue(token.value);
      if (safe) return safe;
    }
  }
  if (accentValue) {
    const c = parseColor(accentValue);
    if (c) {
      const r = Math.max(0, Math.round(c.r * 0.82));
      const g = Math.max(0, Math.round(c.g * 0.82));
      const b = Math.max(0, Math.round(c.b * 0.82));
      if (c.a < 1) return `rgba(${r},${g},${b},${c.a})`;
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
  }
  return undefined;
}

function pickBgSurfaceFallback(
  tokens: ColorToken[],
  nyxVar: NyxVar,
  isDarkTheme: boolean,
): ColorToken | undefined {
  const keywords = nyxVar === "--nyx-bg" ? BG_KEYWORDS : SURFACE_KEYWORDS;
  let best: ColorToken | undefined;
  let bestScore = 0;

  for (const token of tokens) {
    if (isSemanticTintBg(token)) continue;

    const n = normalizeTokenName(token.name);
    const roleName = token.role ? normalizeTokenName(token.role) : "";
    const descName = token.description ? normalizeTokenName(token.description) : "";
    const combined = n + " " + roleName + " " + descName;
    const color = parseColor(token.value);

    if (!isDarkTheme && color && color.a < 0.5) continue;
    if (nyxVar === "--nyx-bg" && color && color.a < 0.9) continue;

    if (!isDarkTheme) {
      if (/\bdark\b/.test(combined)) continue;
      if (/\boverlay\b/.test(combined)) continue;
    } else {
      if (/\blight\b/.test(combined)) continue;
    }
    if (!tokenLuminanceMatches(token, !isDarkTheme)) continue;

    let score = 0;
    for (const { pattern, confidence } of keywords) {
      if (pattern.test(n)) score = Math.max(score, confidence);
      if (roleName && pattern.test(roleName)) score = Math.max(score, confidence - 5);
      if (descName && pattern.test(descName)) score = Math.max(score, confidence - 10);
    }

    if (score > bestScore) {
      bestScore = score;
      best = token;
    }
  }

  return bestScore >= 50 ? best : undefined;
}

function resolveRecipeProp(
  recipe: ComponentRecipe,
  doc: DesignDocument,
  keys: string[],
): string | undefined {
  const raw = pickRecipeProp(recipe.properties, keys);
  if (!raw) return undefined;
  return safeCssValue(resolveRecipeValue(raw, doc));
}

function classifyRecipeAffinity(recipe: ComponentRecipe, doc: DesignDocument): DarkLightAffinity {
  const props = recipe.properties;
  const family = inferRecipeFamily(recipe.name, props);
  const combined = normalizeTokenName(`${recipe.name} ${props.family ?? ""} ${props.role ?? ""}`);

  if (/\b(?:on\s+dark|dark)\b/.test(combined)) return "dark";
  if (/\b(?:on\s+light|light|white|pearl|parchment|canvas)\b/.test(combined)) return "light";

  if (family === "button") return "shared";
  if (family !== "card" && family !== "input") return "shared";

  const background = resolveRecipeProp(recipe, doc, ["backgroundColor", "background-color", "background", "bg"]);
  const foreground = resolveRecipeProp(recipe, doc, ["textColor", "text-color", "foreground", "color", "text"]);

  if (background && background.toLowerCase() !== "transparent") {
    const c = parseColor(background);
    if (c && c.a >= 0.5) {
      const dark = isColorDark(background);
      if (dark === true) return "dark";
      if (dark === false) return "light";
    }
  }

  if (foreground) {
    const dark = isColorDark(foreground);
    if (dark === true) return "light";
    if (dark === false) return "dark";
  }

  return "shared";
}

function isThemeSensitiveRecipeVar(key: string): boolean {
  return new Set([
    "--nyx-surface",
    "--nyx-card-highlight-border",
    "--nyx-input-bg",
    "--nyx-input-border",
    "--nyx-input-focus-ring",
    "--nyx-input-label",
    "--nyx-input-helper",
    "--nyx-input-placeholder",
    "--nyx-btn-primary-text",
    "--nyx-accent-hover",
  ]).has(key);
}

function addRecipeVarsForAffinity(
  target: Map<string, string>,
  entries: [string, string][],
): void {
  for (const [key, value] of entries) {
    target.set(key, value);
  }
}

function isOpaqueLightColor(value: string | undefined): boolean | null {
  if (!value) return null;
  const c = parseColor(value);
  if (!c || c.a < 0.5) return null;
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return lum >= 170;
}

function isOpaqueDarkColor(value: string | undefined): boolean | null {
  if (!value) return null;
  const c = parseColor(value);
  if (!c || c.a < 0.5) return null;
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return lum < 96;
}

function isLowAlphaLightColor(value: string | undefined): boolean {
  if (!value) return false;
  const c = parseColor(value);
  if (!c || c.a >= 0.5) return false;
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return lum >= 170;
}

function safeTokenValue(token: ColorToken | undefined): string | undefined {
  return token ? safeCssValue(token.value) : undefined;
}

function pickThemeSurfaceOrBackground(
  colorTokens: ColorToken[],
  nyxVar: NyxVar,
  isDarkTheme: boolean,
): string | undefined {
  const direct = safeTokenValue(pickBgSurfaceFallback(colorTokens, nyxVar, isDarkTheme));
  if (direct) return direct;
  const alternate = nyxVar === "--nyx-bg" ? "--nyx-surface" : "--nyx-bg";
  return safeTokenValue(pickBgSurfaceFallback(colorTokens, alternate, isDarkTheme));
}

function pickThemeText(
  colorTokens: ColorToken[],
  nyxVar: NyxVar,
  isDarkTheme: boolean,
): string | undefined {
  const keywords =
    nyxVar === "--nyx-text-muted" ? TEXT_MUTED_KEYWORDS :
    nyxVar === "--nyx-text-dim" ? TEXT_DIM_KEYWORDS :
    nyxVar === "--nyx-text-body" ? TEXT_BODY_KEYWORDS :
    TEXT_HEAD_KEYWORDS;
  const token = pickBestForVar(colorTokens.filter((candidate) => {
    const c = parseColor(candidate.value);
    if (!c || c.a < 0.5) return true;
    const dark = isColorDark(candidate.value);
    if (dark === null) return true;
    return isDarkTheme ? !dark : dark;
  }), nyxVar, keywords, isDarkTheme);
  return safeTokenValue(token);
}

function applyLightThemeDefaults(vars: Map<string, string>): void {
  const defaults: [string, string][] = [
    ["--nyx-bg", "#f5f5f7"],
    ["--nyx-surface", "#ffffff"],
    ["--nyx-surface-elevated", "rgba(0,0,0,0.04)"],
    ["--nyx-text-head", "#1d1d1f"],
    ["--nyx-text-body", "rgba(0,0,0,0.72)"],
    ["--nyx-text-muted", "rgba(0,0,0,0.6)"],
    ["--nyx-text-dim", "rgba(0,0,0,0.35)"],
    ["--nyx-sep", "rgba(0,0,0,0.08)"],
    ["--nyx-input-bg", "#ffffff"],
    ["--nyx-input-label", "rgba(0,0,0,0.65)"],
    ["--nyx-input-helper", "rgba(0,0,0,0.45)"],
    ["--nyx-input-placeholder", "rgba(0,0,0,0.35)"],
  ];
  for (const [key, value] of defaults) vars.set(key, value);
}

function repairThemePolarity(
  vars: Map<string, string>,
  colorTokens: ColorToken[],
  isDarkTheme: boolean,
): void {
  if (isDarkTheme) {
    if (isOpaqueLightColor(vars.get("--nyx-bg")) === true) {
      vars.set("--nyx-bg", pickThemeSurfaceOrBackground(colorTokens, "--nyx-bg", true) ?? "#000000");
    }
    if (isOpaqueLightColor(vars.get("--nyx-surface")) === true) {
      vars.set("--nyx-surface", pickThemeSurfaceOrBackground(colorTokens, "--nyx-surface", true) ?? "rgba(255,255,255,0.05)");
    }
    for (const key of ["--nyx-text-head", "--nyx-text-body"] as const) {
      if (isOpaqueDarkColor(vars.get(key)) === true) {
        vars.set(key, pickThemeText(colorTokens, key, true) ?? "#ffffff");
      }
    }
    if (isOpaqueDarkColor(vars.get("--nyx-text-muted")) === true) {
      vars.set("--nyx-text-muted", pickThemeText(colorTokens, "--nyx-text-muted", true) ?? "rgba(255,255,255,0.6)");
    }
    if (isOpaqueDarkColor(vars.get("--nyx-text-dim")) === true) {
      vars.set("--nyx-text-dim", pickThemeText(colorTokens, "--nyx-text-dim", true) ?? "rgba(255,255,255,0.35)");
    }
    if (isOpaqueLightColor(vars.get("--nyx-sep")) === true) {
      vars.set("--nyx-sep", "rgba(255,255,255,0.06)");
    }
    if (isOpaqueLightColor(vars.get("--nyx-input-bg")) === true) {
      vars.set("--nyx-input-bg", vars.get("--nyx-surface") ?? "rgba(255,255,255,0.05)");
    }
    for (const [key, fallback] of [
      ["--nyx-input-label", "rgba(255,255,255,0.7)"],
      ["--nyx-input-helper", "rgba(255,255,255,0.45)"],
      ["--nyx-input-placeholder", "rgba(255,255,255,0.3)"],
    ] as const) {
      if (isOpaqueDarkColor(vars.get(key)) === true) vars.set(key, fallback);
    }
    return;
  }

  if (isOpaqueDarkColor(vars.get("--nyx-bg")) === true) {
    vars.set("--nyx-bg", pickThemeSurfaceOrBackground(colorTokens, "--nyx-bg", false) ?? "#f5f5f7");
  }
  if (isOpaqueDarkColor(vars.get("--nyx-surface")) === true) {
    vars.set("--nyx-surface", pickThemeSurfaceOrBackground(colorTokens, "--nyx-surface", false) ?? "#ffffff");
  }
  for (const key of ["--nyx-text-head", "--nyx-text-body"] as const) {
    if (isOpaqueLightColor(vars.get(key)) === true) {
      vars.set(key, pickThemeText(colorTokens, key, false) ?? "#1d1d1f");
    }
  }
  if (isOpaqueLightColor(vars.get("--nyx-text-muted")) === true) {
    vars.set("--nyx-text-muted", pickThemeText(colorTokens, "--nyx-text-muted", false) ?? "rgba(0,0,0,0.6)");
  }
  if (isOpaqueLightColor(vars.get("--nyx-text-dim")) === true) {
    vars.set("--nyx-text-dim", pickThemeText(colorTokens, "--nyx-text-dim", false) ?? "rgba(0,0,0,0.35)");
  }
  if (isLowAlphaLightColor(vars.get("--nyx-text-muted"))) {
    vars.set("--nyx-text-muted", "rgba(0,0,0,0.6)");
  }
  if (isLowAlphaLightColor(vars.get("--nyx-text-dim"))) {
    vars.set("--nyx-text-dim", "rgba(0,0,0,0.35)");
  }
  if (isLowAlphaLightColor(vars.get("--nyx-sep"))) {
    vars.set("--nyx-sep", "rgba(0,0,0,0.08)");
  }
  if (isOpaqueDarkColor(vars.get("--nyx-input-bg")) === true) {
    vars.set("--nyx-input-bg", vars.get("--nyx-surface") ?? "#ffffff");
  }

  const bgLooksDark = isOpaqueDarkColor(vars.get("--nyx-bg")) === true;
  const textLooksLight = isOpaqueLightColor(vars.get("--nyx-text-head")) === true;
  if (bgLooksDark && textLooksLight) applyLightThemeDefaults(vars);
}

function fillMissingOppositeVars(
  targetVars: Map<string, string>,
  sourceVars: Map<string, string>,
  targetIsDark: boolean,
): void {
  if (!targetVars.has("--nyx-bg") && sourceVars.has("--nyx-bg")) {
    targetVars.set(
      "--nyx-bg",
      targetIsDark
        ? darkenColorConservative(sourceVars.get("--nyx-bg")!, "bg")
        : lightenColorConservative(sourceVars.get("--nyx-bg")!, "bg"),
    );
  }
  if (!targetVars.has("--nyx-surface") && sourceVars.has("--nyx-surface")) {
    targetVars.set(
      "--nyx-surface",
      targetIsDark
        ? darkenColorConservative(sourceVars.get("--nyx-surface")!, "surface")
        : lightenColorConservative(sourceVars.get("--nyx-surface")!, "surface"),
    );
  }
  for (const [key, value] of sourceVars) {
    if (targetVars.has(key)) continue;
    const derived = deriveOppositeVar(key, value, targetIsDark);
    if (derived !== undefined) targetVars.set(key, derived);
  }
}

export function buildShowcaseCSS(doc: DesignDocument): string | null {
  const colorTokens = doc.spec.colorTokens ?? [];
  const radiusTokens = doc.spec.radiusTokens ?? [];
  const recipes = doc.spec.componentRecipes ?? [];

  const darkSpecificTokens: ColorToken[] = [];
  const lightSpecificTokens: ColorToken[] = [];
  const sharedTokens: ColorToken[] = [];

  for (const token of colorTokens) {
    const affinity = classifyTokenAffinity(token);
    if (affinity === "dark") darkSpecificTokens.push(token);
    else if (affinity === "light") lightSpecificTokens.push(token);
    else sharedTokens.push(token);
  }

  const lightVars = new Map<string, string>();
  const darkVars = new Map<string, string>();

  for (const mapping of COLOR_MAPPINGS) {
    const lightBest = pickBestForVar(sharedTokens, mapping.nyxVar, mapping.keywords, false);
    if (lightBest) {
      const safe = safeCssValue(lightBest.value);
      if (safe) lightVars.set(mapping.nyxVar, safe);
    }
    const lightSpecificBest = pickBestForVar(lightSpecificTokens, mapping.nyxVar, mapping.keywords, false);
    if (lightSpecificBest) {
      const safe = safeCssValue(lightSpecificBest.value);
      if (safe) lightVars.set(mapping.nyxVar, safe);
    }

    const darkBest = pickBestForVar(sharedTokens, mapping.nyxVar, mapping.keywords, true);
    if (darkBest) {
      const safe = safeCssValue(darkBest.value);
      if (safe) darkVars.set(mapping.nyxVar, safe);
    }
    const darkSpecificBest = pickBestForVar(darkSpecificTokens, mapping.nyxVar, mapping.keywords, true);
    if (darkSpecificBest) {
      const safe = safeCssValue(darkSpecificBest.value);
      if (safe) darkVars.set(mapping.nyxVar, safe);
    }
  }

  if (!lightVars.has("--nyx-bg")) {
    const fallback = pickBgSurfaceFallback(colorTokens, "--nyx-bg", false);
    if (fallback) {
      const safe = safeCssValue(fallback.value);
      if (safe) lightVars.set("--nyx-bg", safe);
    }
  }
  if (!lightVars.has("--nyx-surface")) {
    const fallback = pickBgSurfaceFallback(colorTokens, "--nyx-surface", false);
    if (fallback) {
      const safe = safeCssValue(fallback.value);
      if (safe) lightVars.set("--nyx-surface", safe);
    }
  }
  if (!darkVars.has("--nyx-bg")) {
    const fallback = pickBgSurfaceFallback(colorTokens, "--nyx-bg", true);
    if (fallback) {
      const safe = safeCssValue(fallback.value);
      if (safe) darkVars.set("--nyx-bg", safe);
    }
  }
  if (!darkVars.has("--nyx-surface")) {
    const fallback = pickBgSurfaceFallback(colorTokens, "--nyx-surface", true);
    if (fallback) {
      const safe = safeCssValue(fallback.value);
      if (safe) darkVars.set("--nyx-surface", safe);
    }
  }

  if (!lightVars.has("--nyx-accent")) {
    const brandToken = sharedTokens.find((t) => {
      const n = normalizeTokenName(t.name);
      if (n === "brand" || t.role === "brand") return !isOnVariant(n) && !isPaletteAccentToken(t);
      return false;
    });
    if (brandToken) {
      const safe = safeCssValue(brandToken.value);
      if (safe) lightVars.set("--nyx-accent", safe);
    }
  }

  if (!darkVars.has("--nyx-accent")) {
    const darkBrandToken = [...sharedTokens, ...darkSpecificTokens].find((t) => {
      const n = normalizeTokenName(t.name);
      if (n === "brand" || t.role === "brand") return !isOnVariant(n) && !isPaletteAccentToken(t);
      return false;
    });
    if (darkBrandToken) {
      const safe = safeCssValue(darkBrandToken.value);
      if (safe) darkVars.set("--nyx-accent", safe);
    }
  }

  const allClaimed = new Set<string>();
  const lightAccent = lightVars.get("--nyx-accent");
  const darkAccent = darkVars.get("--nyx-accent") ?? lightAccent;

  if (!lightVars.has("--nyx-accent-hover")) {
    const hover = pickAccentHoverFromTokens(colorTokens, lightAccent, allClaimed);
    if (hover) lightVars.set("--nyx-accent-hover", hover);
  }
  if (!darkVars.has("--nyx-accent-hover")) {
    const hover = pickAccentHoverFromTokens(colorTokens, darkAccent, allClaimed);
    if (hover) darkVars.set("--nyx-accent-hover", hover);
  }

  const sharedRecipeVars = new Map<string, string>();
  const lightRecipeVars = new Map<string, string>();
  const darkRecipeVars = new Map<string, string>();
  const hasRecipeVar = (key: string): boolean =>
    sharedRecipeVars.has(key) || lightRecipeVars.has(key) || darkRecipeVars.has(key);

  // Collect generic radius token mappings first (lowest priority)
  const genericRadiusVars = new Map<string, string>();
  let hasGlobalZeroRadius = false;
  let globalRadiusValue: string | undefined;
  for (const token of radiusTokens) {
    const m = mapRadiusToken(token);
    if (m) {
      if (m[0] === "--nyx-radius-global-zero") {
        hasGlobalZeroRadius = true;
      } else if (m[0] === "--nyx-radius-global") {
        globalRadiusValue = m[1];
      } else {
        genericRadiusVars.set(m[0], m[1]);
      }
    }
  }

  // Apply recipe styles (component recipe radius beats generic radius tokens)
  for (const recipe of recipes) {
    const m = mapRecipeStyles(recipe, doc);
    if (m.length === 0) continue;
    const affinity = classifyRecipeAffinity(recipe, doc);
    const sharedEntries = m.filter(([key]) => !isThemeSensitiveRecipeVar(key));
    const themedEntries = m.filter(([key]) => isThemeSensitiveRecipeVar(key));

    addRecipeVarsForAffinity(sharedRecipeVars, sharedEntries);
    if (affinity === "light") {
      addRecipeVarsForAffinity(lightRecipeVars, themedEntries);
    } else if (affinity === "dark") {
      addRecipeVarsForAffinity(darkRecipeVars, themedEntries);
    } else {
      addRecipeVarsForAffinity(sharedRecipeVars, themedEntries);
    }
  }

  if (globalRadiusValue) {
    const radiusTargets = [
      "--nyx-radius-btn",
      "--nyx-radius-card",
      "--nyx-radius-input",
      "--nyx-radius-badge",
      "--nyx-radius-tag",
      "--nyx-radius-table",
      "--nyx-radius-callout",
    ];
    for (const target of radiusTargets) {
      if (!hasRecipeVar(target) && !genericRadiusVars.has(target)) {
        genericRadiusVars.set(target, globalRadiusValue);
      }
    }
  }

  // Apply generic radius tokens only where recipe didn't set a value
  for (const [k, v] of genericRadiusVars) {
    if (!hasRecipeVar(k)) {
      sharedRecipeVars.set(k, v);
    }
  }

  // If design states all interactive elements use 0px radius, apply as fallback
  if (hasGlobalZeroRadius) {
    const radiusTargets = [
      "--nyx-radius-btn",
      "--nyx-radius-card",
      "--nyx-radius-input",
      "--nyx-radius-badge",
      "--nyx-radius-tag",
      "--nyx-radius-table",
      "--nyx-radius-callout",
    ];
    for (const target of radiusTargets) {
      if (!hasRecipeVar(target)) {
        sharedRecipeVars.set(target, "0px");
      }
    }
  }

  const typographyVars = buildTypographyVars(doc);

  if (
    lightVars.size === 0 &&
    darkVars.size === 0 &&
    sharedRecipeVars.size === 0 &&
    lightRecipeVars.size === 0 &&
    darkRecipeVars.size === 0 &&
    typographyVars.size === 0
  ) return null;

  for (const [k, v] of sharedRecipeVars) {
    lightVars.set(k, v);
    darkVars.set(k, v);
  }
  for (const [k, v] of lightRecipeVars) {
    lightVars.set(k, v);
  }
  for (const [k, v] of darkRecipeVars) {
    darkVars.set(k, v);
  }
  for (const [key, value] of typographyVars) {
    lightVars.set(key, value);
    darkVars.set(key, value);
  }

  fillDerivedVars(lightVars, lightAccent, false);

  if (!lightVars.has("--nyx-bg") && lightVars.has("--nyx-surface")) {
    lightVars.set("--nyx-bg", lightVars.get("--nyx-surface")!);
  }
  if (!lightVars.has("--nyx-bg")) {
    lightVars.set("--nyx-bg", pickThemeSurfaceOrBackground(colorTokens, "--nyx-bg", false) ?? "#f5f5f7");
  }
  if (!lightVars.has("--nyx-surface")) {
    lightVars.set("--nyx-surface", pickThemeSurfaceOrBackground(colorTokens, "--nyx-surface", false) ?? "#ffffff");
  }
  if (!lightVars.has("--nyx-text-head")) {
    lightVars.set("--nyx-text-head", pickThemeText(colorTokens, "--nyx-text-head", false) ?? "#1d1d1f");
  }
  if (!lightVars.has("--nyx-text-body")) {
    lightVars.set("--nyx-text-body", pickThemeText(colorTokens, "--nyx-text-body", false) ?? lightVars.get("--nyx-text-head") ?? "rgba(0,0,0,0.72)");
  }

  const hasExplicitDark = darkColorVarsHasContent(darkVars, lightVars);

  fillDerivedVars(darkVars, darkAccent, true);
  fillMissingOppositeVars(darkVars, lightVars, true);
  if (!darkVars.has("--nyx-bg")) {
    darkVars.set("--nyx-bg", pickThemeSurfaceOrBackground(colorTokens, "--nyx-bg", true) ?? "#000000");
  }
  if (!darkVars.has("--nyx-surface")) {
    darkVars.set("--nyx-surface", pickThemeSurfaceOrBackground(colorTokens, "--nyx-surface", true) ?? "rgba(255,255,255,0.05)");
  }
  if (!darkVars.has("--nyx-text-head")) {
    darkVars.set("--nyx-text-head", pickThemeText(colorTokens, "--nyx-text-head", true) ?? "#ffffff");
  }
  if (!darkVars.has("--nyx-text-body")) {
    darkVars.set("--nyx-text-body", pickThemeText(colorTokens, "--nyx-text-body", true) ?? darkVars.get("--nyx-text-head") ?? "rgba(255,255,255,0.85)");
  }

  if (!hasExplicitDark) {
    const derivedDark = new Map<string, string>();

    if (!darkVars.has("--nyx-bg") && lightVars.has("--nyx-bg")) {
      derivedDark.set("--nyx-bg", darkenColorConservative(lightVars.get("--nyx-bg")!, "bg"));
    }
    if (!darkVars.has("--nyx-surface") && lightVars.has("--nyx-surface")) {
      derivedDark.set("--nyx-surface", darkenColorConservative(lightVars.get("--nyx-surface")!, "surface"));
    }

    for (const [key, value] of lightVars) {
      if (derivedDark.has(key)) continue;
      const derived = deriveOppositeVar(key, value, true);
      if (derived !== undefined) derivedDark.set(key, derived);
    }
    for (const [key, value] of derivedDark) {
      darkVars.set(key, value);
    }
    fillDerivedVars(darkVars, darkAccent, true);
  }

  repairThemePolarity(lightVars, colorTokens, false);
  repairThemePolarity(darkVars, colorTokens, true);

  const baseVars = new Map(lightVars);

  const sortedEntries = (vars: Map<string, string>): string[] =>
    [...vars.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`);

  const darkDecls = sortedEntries(darkVars).join(";");
  const lightDecls = sortedEntries(lightVars).join(";");
  const baseDecls = sortedEntries(baseVars).join(";");

  return [
    `.nyx-showcase,.design-mode-scroll{${baseDecls}}`,
    `[data-theme="dark"] .nyx-showcase,[data-theme="dark"] .design-mode-scroll{${darkDecls}}`,
    `[data-theme="light"] .nyx-showcase,[data-theme="light"] .design-mode-scroll{${lightDecls}}`,
  ].join("");
}

function darkColorVarsHasContent(darkVars: Map<string, string>, lightVars: Map<string, string>): boolean {
  const darkSensitiveVars = new Set([
    "--nyx-bg", "--nyx-surface", "--nyx-surface-elevated",
    "--nyx-text-head", "--nyx-text-body", "--nyx-text-muted", "--nyx-text-dim",
    "--nyx-sep", "--nyx-neutral-bg", "--nyx-neutral-text",
    "--nyx-tag-neutral-bg", "--nyx-callout-text",
    "--nyx-btn-primary-text", "--nyx-btn-secondary-hover", "--nyx-mobile-row-text",
    "--nyx-input-bg", "--nyx-input-border", "--nyx-input-focus-ring",
    "--nyx-input-label", "--nyx-input-helper", "--nyx-input-placeholder",
  ]);
  for (const key of darkSensitiveVars) {
    if (darkVars.has(key) && darkVars.get(key) !== lightVars.get(key)) return true;
  }
  if (darkVars.has("--nyx-accent") && lightVars.get("--nyx-accent") !== darkVars.get("--nyx-accent")) return true;
  return false;
}

export {
  buildTypographyVars,
  findFontFamily,
  getTypography,
  normalizeTokenName,
  isOnVariant,
  safeCssValue,
  sanitizeFontFamilyName,
  extractPrimaryFontFamilyName,
  extractFamilyFromValue,
  cleanFontFamilyText,
  quoteFontFamily,
  withFontFallback,
  inferFontGeneric,
  clampPageFontSize,
  parseColor,
  isColorDark,
  detectIsDarkTheme,
  invertColor,
  invertThemeVars,
  fillDerivedVars,
  mapRadiusToken,
  mapRecipeStyles,
  resolveRecipeValue,
  inferRecipeFamily,
  isGenericCardRecipe,
  pickRecipeProp,
  scoreToken,
  scoreTokenForVar,
  pickBest,
  pickBestForVar,
  isTextLikeToken,
  isPaletteAccentToken,
  type ParsedTypography,
  type TypographyRole,
  type TypographyEntry,
};

export function collectDesignFontFamilyNames(doc: DesignDocument): string[] {
  const names = new Map<string, string>();

  for (const token of doc.spec.typographyTokens ?? []) {
    const typography = getTypography(doc, token);
    addPrimaryFontFamilyName(names, typography.fontFamily);
    addPrimaryFontFamilyName(names, extractFamilyFromValue(token.value));
  }

  addPrimaryFontFamilyName(names, findFontFamily(doc));

  return [...names.values()];
}

function addPrimaryFontFamilyName(names: Map<string, string>, familyStack: string | undefined): void {
  const primary = extractPrimaryFontFamilyName(familyStack);
  if (!primary) return;
  names.set(primary.toLowerCase(), primary);
}

export function buildGoogleFontStylesheetUrl(family: string): string | undefined {
  const safe = sanitizeFontFamilyName(family);
  if (!safe || isGenericFontFamily(safe)) return undefined;

  const params = new URLSearchParams({
    family: safe,
    display: "swap",
  });

  return `https://fonts.googleapis.com/css2?${params.toString()}`;
}
