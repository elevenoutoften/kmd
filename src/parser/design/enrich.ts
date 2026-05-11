/**
 * Semantic enrichment stage for the design pipeline.
 *
 * Runs after resolve.  Enriches color tokens with:
 *   - Role inference (name patterns + value heuristics)
 *   - Group classification (Brand, Neutrals, Surface, Semantic, Other)
 *   - Light/Dark pair inference
 *
 * Also checks font availability against a curated allowlist and emits
 * `font-unavailable` diagnostics for unknown families.
 */

import type {
  ColorRole,
  ColorGroup,
  ColorToken,
  DesignDocument,
} from "./ir";

// ---------------------------------------------------------------------------
// Font allowlist
// ---------------------------------------------------------------------------

const ALLOWED_FONTS: ReadonlySet<string> = new Set([
  "Inter",
  "Poppins",
  "Nunito",
  "IBM Plex Sans",
  "IBM Plex Mono",
  "DM Sans",
  "Space Mono",
  "General Sans",
  "Sohne",
  "JetBrains Mono",
  "SF Pro",
]);

/** Generic CSS font families that never require a diagnostic. */
const GENERIC_FAMILIES: ReadonlySet<string> = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "system-ui",
  "cursive",
  "fantasy",
]);

// ---------------------------------------------------------------------------
// Role name patterns (order matters — first match wins)
// ---------------------------------------------------------------------------

const ROLE_NAME_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  role: ColorRole;
}> = [
  { pattern: /\bprimary\b/i, role: "brand" },
  { pattern: /\bsecondary\b/i, role: "accent" },
  { pattern: /\bbackground\b|\bbg\b/i, role: "background" },
  { pattern: /\bsurface\b/i, role: "surface" },
  { pattern: /\btext\b|\bforeground\b|\bink\b/i, role: "text" },
  { pattern: /\bmuted\b|\bsubtle\b/i, role: "text-muted" },
  { pattern: /\bborder\b|\bdivider\b/i, role: "divider" },
  { pattern: /\bsuccess\b|\bgreen\b/i, role: "success" },
  { pattern: /\bwarning\b|\byellow\b/i, role: "warning" },
  { pattern: /\berror\b|\bdanger\b|\bred\b/i, role: "error" },
  { pattern: /\binfo\b|\bblue\b/i, role: "info" },
];

// ---------------------------------------------------------------------------
// Color parsing utilities
// ---------------------------------------------------------------------------

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseHex(value: string): RGB | null {
  const m = value.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return {
    r: parseInt(m[1]!, 16),
    g: parseInt(m[2]!, 16),
    b: parseInt(m[3]!, 16),
  };
}

/** sRGB relative luminance (WCAG 2.x formula). */
function sRGBLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** HSL saturation (0–1). */
function hslSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const d = max - min;
  const l = (max + min) / 2;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

// ---------------------------------------------------------------------------
// Role inference
// ---------------------------------------------------------------------------

/**
 * Strip common design-token prefixes so "color-primary" and "primary"
 * produce the same normalised string for pattern matching.
 */
function normaliseTokenName(name: string): string {
  return name
    .replace(/^(--)?color[-_]?/i, "")
    .replace(/[-_]/g, " ");
}

function inferRoleFromName(name: string): ColorRole | null {
  const norm = normaliseTokenName(name);
  for (const { pattern, role } of ROLE_NAME_PATTERNS) {
    if (pattern.test(norm)) return role;
  }
  return null;
}

function inferRoleFromValue(value: string): ColorRole | null {
  const hex = parseHex(value);
  if (!hex) return null;

  const lum = sRGBLuminance(hex.r, hex.g, hex.b);
  const sat = hslSaturation(hex.r, hex.g, hex.b);

  // Very high luminance → background / surface
  if (lum > 0.7) return "background";
  // Very dark + desaturated → text
  if (lum < 0.15 && sat < 0.15) return "text";
  // High saturation (even when dark) → brand
  if (sat > 0.4) return "brand";
  // Very dark (with some colour) → text as fallback
  if (lum < 0.15) return "text";

  return null;
}

function inferRole(token: ColorToken): ColorRole {
  return inferRoleFromName(token.name) ?? inferRoleFromValue(token.value) ?? "other";
}

// ---------------------------------------------------------------------------
// Group inference
// ---------------------------------------------------------------------------

function inferGroup(role: ColorRole, token: ColorToken): ColorGroup {
  switch (role) {
    case "brand":
    case "accent":
      return "Brand";
    case "text":
    case "text-muted":
    case "divider":
      return "Neutrals";
    case "surface":
    case "background":
      return "Surface";
    case "success":
    case "warning":
    case "error":
    case "info":
      return "Semantic";
    default: {
      const hex = parseHex(token.value);
      if (hex && hslSaturation(hex.r, hex.g, hex.b) < 0.1) return "Neutrals";
      return "Other";
    }
  }
}

// ---------------------------------------------------------------------------
// Pair inference
// ---------------------------------------------------------------------------

/**
 * Name patterns that imply a light/dark counterpart.
 * Each entry maps a suffix/prefix on the bare name to the companion pattern.
 */
const PAIR_PATTERNS: ReadonlyArray<{
  /** Regex tested against the bare name (prefix-stripped). */
  match: RegExp;
  /**
   * Replacement to derive the counterpart name.
   * `$1` refers to the first capture group in `match`.
   */
  companion: string;
}> = [
  { match: /^(.+)-on-dark$/, companion: "$1" },
  { match: /^(.+)-dark$/, companion: "$1" },
  { match: /^(.+)-light$/, companion: "$1" },
  { match: /^on-(.+)$/, companion: "$1" },
];

function inferPairs(tokens: readonly ColorToken[]): void {
  const byName = new Map<string, ColorToken>();
  for (const t of tokens) {
    byName.set(t.name, t);
  }

  for (const token of tokens) {
    if (token.pair) continue; // already paired

    const bare = normaliseTokenName(token.name);

    for (const { match, companion } of PAIR_PATTERNS) {
      const m = match.exec(bare);
      if (!m) continue;

      const companionBare = bare.replace(match, companion);
      // Try to find the companion by iterating candidate names.
      const candidate = findCandidate(byName, companionBare);
      if (candidate && candidate !== token && !candidate.pair) {
        token.pair = candidate.name;
        candidate.pair = token.name;
      }
      break; // first matching pattern wins
    }
  }

  // Value-based fallback: pair tokens with extreme luminance contrast
  // that share a significant name fragment.
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i]!;
    if (a.pair) continue;
    const hexA = parseHex(a.value);
    if (!hexA) continue;
    const lumA = sRGBLuminance(hexA.r, hexA.g, hexA.b);

    for (let j = i + 1; j < tokens.length; j++) {
      const b = tokens[j]!;
      if (b.pair) continue;
      const hexB = parseHex(b.value);
      if (!hexB) continue;
      const lumB = sRGBLuminance(hexB.r, hexB.g, hexB.b);

      if (Math.abs(lumA - lumB) < 0.5) continue;

      // Check for shared name fragment (length > 2 to avoid short words)
      const bareA = normaliseTokenName(a.name).split(/\s+/);
      const bareB = normaliseTokenName(b.name).split(/\s+/);
      const shared = bareA.some(
        (w) => w.length > 2 && bareB.includes(w),
      );
      if (shared) {
        a.pair = b.name;
        b.pair = a.name;
        break;
      }
    }
  }
}

/**
 * Look up a companion token by trying several naming conventions.
 * Design-doc token names may include "color-" prefixes or not.
 */
function findCandidate(
  byName: Map<string, ColorToken>,
  bare: string,
): ColorToken | undefined {
  // Normalise bare name back to common token formats.
  const kebab = bare.replace(/\s+/g, "-");
  const candidates = [
    kebab,
    `color-${kebab}`,
    `--color-${kebab}`,
  ];
  for (const c of candidates) {
    const found = byName.get(c);
    if (found) return found;
  }
  // Also try matching against the normalised names of all tokens.
  for (const token of byName.values()) {
    if (normaliseTokenName(token.name) === bare) return token;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Font availability
// ---------------------------------------------------------------------------

/**
 * Extract the primary (first-listed) font family from a CSS font-family value.
 * Strips surrounding quotes.
 */
function extractPrimaryFont(fontFamily: string): string | null {
  const first = fontFamily.split(",")[0]?.trim();
  if (!first) return null;
  return first.replace(/^["']|["']$/g, "");
}

function isAllowedFont(name: string): boolean {
  if (ALLOWED_FONTS.has(name)) return true;
  // Allow prefix matching for families like "SF Pro Display" → "SF Pro".
  for (const allowed of ALLOWED_FONTS) {
    if (name.startsWith(allowed + " ")) return true;
  }
  return false;
}

function checkFontAvailability(doc: DesignDocument): void {
  const reported = new Set<string>();
  const tokens = doc.spec.typographyTokens ?? [];

  for (const token of tokens) {
    let fontFamily: string | null = null;
    let hasSubstitute = false;

    // CSS extractor format: value starts with "family:"
    if (token.value.startsWith("family:")) {
      fontFamily = token.value.slice(7).trim();
    }
    // YAML extractor format: value is a JSON object with font-family key
    else if (token.value.startsWith("{")) {
      try {
        const obj = JSON.parse(token.value) as Record<string, unknown>;
        if (typeof obj["font-family"] === "string") {
          fontFamily = obj["font-family"];
        }
        if (obj["Substitute"]) hasSubstitute = true;
      } catch {
        // Not valid JSON — skip
      }
    }

    if (!fontFamily) continue;

    const primary = extractPrimaryFont(fontFamily);
    if (!primary) continue;
    if (GENERIC_FAMILIES.has(primary.toLowerCase())) continue;
    if (reported.has(primary)) continue;

    if (isAllowedFont(primary)) continue;
    if (hasSubstitute) continue;

    // Check spec.raw for a Substitute field on the typography entry.
    if (!hasSubstituteFromRaw(doc, token.name)) {
      reported.add(primary);
      doc.diagnostics.push({
        severity: "warning",
        token: "font-unavailable",
        message: `Font "${primary}" is not in the curated allowlist and has no Substitute specified.`,
      });
    }
  }
}

function hasSubstituteFromRaw(
  doc: DesignDocument,
  tokenName: string,
): boolean {
  const rawTypo = doc.spec.raw?.["typography"];
  if (!rawTypo || typeof rawTypo !== "object") return false;
  const entry = (rawTypo as Record<string, unknown>)[tokenName];
  if (!entry || typeof entry !== "object") return false;
  return "Substitute" in (entry as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enrich a DesignDocument in place.
 *
 * Assigns roles, groups, and pairs to color tokens.  Checks font
 * availability and emits diagnostics for unknown families.
 */
export function enrichSpec(doc: DesignDocument): void {
  const colorTokens = doc.spec.colorTokens ?? [];

  // 1. Role inference
  for (const token of colorTokens) {
    token.role = inferRole(token);
  }

  // 2. Group inference
  for (const token of colorTokens) {
    token.group = inferGroup(token.role ?? "other", token);
  }

  // 3. Pair inference
  inferPairs(colorTokens);

  // 4. Font availability
  checkFontAvailability(doc);
}
