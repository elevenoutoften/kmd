/**
 * Design-mode showcase theme — kmd wrapper over the kmd-web engine.
 *
 * The token extractor lives in @axis-love/design (buildShowcaseThemeVars,
 * KWEB-068): it is the single DESIGN.md → theme-variable extractor shared by
 * this showcase and the reader theme emitter, so what design mode shows is
 * exactly what the reader is themed with. This module only owns the
 * presentation half: serializing the extracted variable maps onto the
 * showcase selectors.
 */
import type { DesignDocument } from "@axis-love/design";
import { buildShowcaseThemeVars } from "@axis-love/design";

export {
  buildGoogleFontStylesheetUrl,
  buildShowcaseThemeVars,
  buildTypographyVars,
  clampPageFontSize,
  cleanFontFamilyText,
  collectDesignFontFamilyNames,
  detectIsDarkTheme,
  extractFamilyFromValue,
  extractPrimaryFontFamilyName,
  fillDerivedVars,
  findFontFamily,
  getTypography,
  inferFontGeneric,
  inferRecipeFamily,
  invertColor,
  invertThemeVars,
  isColorDark,
  isGenericCardRecipe,
  isOnVariant,
  isPaletteAccentToken,
  isTextLikeToken,
  mapRadiusToken,
  mapRecipeStyles,
  normalizeTokenName,
  type ParsedTypography,
  parseColor,
  pickBest,
  pickBestForVar,
  pickRecipeProp,
  quoteFontFamily,
  resolveRecipeValue,
  safeCssValue,
  sanitizeFontFamilyName,
  scoreToken,
  scoreTokenForVar,
  type ShowcaseThemeVars,
  type TypographyEntry,
  type TypographyRole,
  withFontFallback,
} from "@axis-love/design";

function sortedDecls(vars: ReadonlyMap<string, string>): string {
  return [...vars.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/**
 * Showcase stylesheet for a design document: the light variables as the
 * base, plus explicit [data-theme] blocks. Returns null when the document
 * yields nothing themeable.
 */
export function buildShowcaseCSS(doc: DesignDocument): string | null {
  const vars = buildShowcaseThemeVars(doc);
  if (!vars) return null;

  const darkDecls = sortedDecls(vars.dark);
  const lightDecls = sortedDecls(vars.light);

  return [
    `.nyx-showcase,.design-mode-scroll{${lightDecls}}`,
    `[data-theme="dark"] .nyx-showcase,[data-theme="dark"] .design-mode-scroll{${darkDecls}}`,
    `[data-theme="light"] .nyx-showcase,[data-theme="light"] .design-mode-scroll{${lightDecls}}`,
  ].join("");
}
