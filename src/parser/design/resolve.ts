/**
 * Reference resolver for the design pipeline.
 *
 * Resolves token references in component recipe properties and token values:
 * - `{group.name}` → look up in merged token tables
 * - `{name}`       → look up across all groups (no group)
 * - `var(--name)`  → CSS variable reference
 * - `${name}`      → template reference
 * - `tokens.group.name` → dot-notation reference
 *
 * Group matching is case-insensitive; name matching is case-preserving.
 * Group aliases let `{rounded.full}`, `{radius.full}`, and `{color.primary}`
 * resolve through the canonical `radii` and `colors` groups.
 * A suffix-matching fallback allows `{colors.primary}` to resolve against
 * a token named `color-primary` within the `colors` group.
 *
 * Composite typography expansion: when a component property value is a sole
 * reference to a typography token whose value is a JSON object, each property
 * of that object is expanded into the component recipe with camelCase keys.
 *
 * Diagnostics:
 * - `broken-ref`  (warning): unresolved reference; original text kept as fallback.
 * - `circular-ref` (error) : cycle detected; first-encountered value preserved.
 */

import type { DesignDocument, Diagnostic } from "./ir";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a kebab-case string to camelCase. */
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Lookup index
// ---------------------------------------------------------------------------

/**
 * Builds a lookup index from a DesignDocument's merged tokens.
 *
 * For each group (colors, typography, spacing, …), the index stores a
 * name→value map populated from both flat maps and typed token arrays.
 * Token arrays override flat-map entries (they are higher priority).
 */
class LookupIndex {
  private readonly groups = new Map<string, Map<string, string>>();
  /** Ordered group names for cross-group fallback lookups. */
  readonly groupOrder: string[];

  /**
   * Canonical group aliases. Keys are alternate group names a user might
   * write in references; values are the canonical group name stored in the
   * index. Lookup falls through to the canonical group when the alias key
   * has no group of its own.
   */
  private static readonly GROUP_ALIASES: Record<string, string> = {
    rounded: "radii",
    radius: "radii",
    color: "colors",
  };

  constructor(doc: DesignDocument) {
    // Flat maps (lower priority — filled first)
    this.addFlatMap("colors", doc.spec.colors);
    this.addFlatMap("spacing", doc.spec.spacing);
    this.addFlatMap("radii", doc.spec.radii);
    this.addFlatMap("layout", doc.spec.layout);
    this.addFlatMap("typography", doc.spec.typography);

    // Typed token arrays (higher priority — override flat maps)
    this.addTokens("colors", doc.spec.colorTokens);
    this.addTokens("typography", doc.spec.typographyTokens);
    this.addTokens("spacing", doc.spec.spacingTokens);
    this.addTokens("radii", doc.spec.radiusTokens);
    this.addTokens("elevation", doc.spec.elevationTokens);
    this.addTokens("surface", doc.spec.surfaceTokens);
    this.addTokens("layout", doc.spec.layoutTokens);
    this.addTokens("gradient", doc.spec.gradientTokens);

    this.groupOrder = [...this.groups.keys()];
  }

  // -- population helpers --------------------------------------------------

  private addFlatMap(group: string, map: Record<string, string>): void {
    const entries = Object.entries(map);
    if (entries.length === 0) return;
    const g = this.ensureGroup(group);
    for (const [k, v] of entries) {
      if (!g.has(k)) g.set(k, v);
    }
  }

  private addTokens(
    group: string,
    tokens: Array<{ name: string; value: string }> | undefined,
  ): void {
    if (!tokens || tokens.length === 0) return;
    const g = this.ensureGroup(group);
    for (const t of tokens) {
      g.set(t.name, t.value); // typed tokens win over flat maps
    }
  }

  private ensureGroup(group: string): Map<string, string> {
    const lower = group.toLowerCase();
    let g = this.groups.get(lower);
    if (!g) {
      g = new Map();
      this.groups.set(lower, g);
    }
    return g;
  }

  // -- lookup --------------------------------------------------------------

  /**
   * Look up a token by group and name.
   *
   * Resolution order within a group:
   *  1. Exact name match
   *  2. Case-insensitive name match
   *  3. Suffix match: key ends with `-${name}` (case-insensitive)
   *
   * When `group` is undefined, searches all groups in insertion order.
   */
  lookup(group: string | undefined, name: string): string | undefined {
    if (group) {
      const lower = group.toLowerCase();
      let g = this.groups.get(lower);
      if (!g) {
        const canonical = LookupIndex.GROUP_ALIASES[lower];
        if (canonical) g = this.groups.get(canonical);
      }
      return g ? this.findInGroup(g, name) : undefined;
    }
    // No group — search all groups
    for (const gName of this.groupOrder) {
      const g = this.groups.get(gName)!;
      const v = this.findInGroup(g, name);
      if (v !== undefined) return v;
    }
    return undefined;
  }

  /**
   * Look up a typography token and return its value parsed as a JSON object.
   * Returns `undefined` if the group doesn't exist, the name isn't found,
   * or the value isn't a valid JSON object.
   */
  lookupTypography(name: string): Record<string, string> | undefined {
    const g = this.groups.get("typography");
    if (!g) return undefined;
    const raw = this.findInGroup(g, name);
    if (raw === undefined) return undefined;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        // Coerce to Record<string, string> — values may be numbers from JSON
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          result[k] = String(v);
        }
        return result;
      }
    } catch {
      // Not JSON — not a composite typography token
    }
    return undefined;
  }

  private findInGroup(
    g: Map<string, string>,
    name: string,
  ): string | undefined {
    // 1. Exact match
    const exact = g.get(name);
    if (exact !== undefined) return exact;

    // 2. Case-insensitive exact match
    const lower = name.toLowerCase();
    for (const [k, v] of g) {
      if (k.toLowerCase() === lower) return v;
    }

    // 3. Suffix match: key ends with -${name} (case-insensitive).
    //    When multiple keys match (e.g. "color-surface" and "color-on-surface"
    //    both ending with "-surface"), prefer the shortest key.
    const suffix = "-" + lower;
    let best: string | undefined;
    let bestKey: string | undefined;
    for (const [k, v] of g) {
      if (k.toLowerCase().endsWith(suffix)) {
        if (bestKey === undefined || k.length < bestKey.length) {
          bestKey = k;
          best = v;
        }
      }
    }
    if (best !== undefined) return best;

    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Reference resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a single reference key.
 *
 * Returns the resolved value, or the original `{ref}` string as fallback
 * when the reference is broken or circular.
 */
function resolveRef(
  ref: string,
  index: LookupIndex,
  resolving: Set<string>,
  diagnostics: Diagnostic[],
): string {
  const key = ref.toLowerCase();

  // Circular reference detection
  if (resolving.has(key)) {
    diagnostics.push({
      severity: "error",
      token: ref,
      message: `Circular reference detected: ${ref}`,
    });
    return `{${ref}}`;
  }

  // Parse group.name or just name
  const dotIdx = ref.indexOf(".");
  const group = dotIdx >= 0 ? ref.substring(0, dotIdx) : undefined;
  const name = dotIdx >= 0 ? ref.substring(dotIdx + 1) : ref;

  const value = index.lookup(group, name);
  if (value === undefined) {
    diagnostics.push({
      severity: "warning",
      token: ref,
      message: `Unresolved reference: {${ref}}`,
    });
    return `{${ref}}`;
  }

  // Recursively resolve the looked-up value
  resolving.add(key);
  const resolved = resolveValueInner(value, index, resolving, diagnostics);
  resolving.delete(key);
  return resolved;
}

/**
 * Resolve all reference patterns within a string value.
 *
 * Handles, in order:
 *  1. `{ref}`     — brace references (not preceded by `$`)
 *  2. `var(--ref)` — CSS variable references
 *  3. `${ref}`    — template references
 *  4. `tokens.group.name` — dot-notation references
 */
function resolveValueInner(
  value: string,
  index: LookupIndex,
  resolving: Set<string>,
  diagnostics: Diagnostic[],
): string {
  let result = value;

  // {ref} — negative lookbehind to exclude ${ref}
  result = result.replace(/(?<!\$)\{([^}]+)\}/g, (_, ref: string) =>
    resolveRef(ref.trim(), index, resolving, diagnostics),
  );

  // var(--ref)
  result = result.replace(/var\(--([^)]+)\)/g, (_, ref: string) =>
    resolveRef(ref.trim(), index, resolving, diagnostics),
  );

  // ${ref}
  result = result.replace(/\$\{([^}]+)\}/g, (_, ref: string) =>
    resolveRef(ref.trim(), index, resolving, diagnostics),
  );

  // tokens.group.name
  result = result.replace(/\btokens\.([a-zA-Z0-9_.]+)/g, (_, ref: string) =>
    resolveRef(ref, index, resolving, diagnostics),
  );

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve all token references in a DesignDocument (mutates in place).
 *
 * 1. Resolves references in component recipe properties.
 * 2. Performs composite typography expansion.
 * 3. Resolves references in typed token values (except typography, which
 *    stores JSON objects).
 *
 * Appends `broken-ref` (warning) and `circular-ref` (error) diagnostics.
 */
export function resolveSpec(doc: DesignDocument): void {
  const index = new LookupIndex(doc);
  const diagnostics: Diagnostic[] = [];

  // -----------------------------------------------------------------------
  // 1. Component recipe properties + composite typography expansion
  // -----------------------------------------------------------------------
  if (doc.spec.componentRecipes) {
    for (const recipe of doc.spec.componentRecipes) {
      const additions: Record<string, string> = {};
      const removals: string[] = [];

      for (const [key, value] of Object.entries(recipe.properties)) {
        // Detect sole typography reference for composite expansion
        const typoMatch = value.match(/^\{typography\.([^}]+)\}$/i);
        if (typoMatch) {
          const typoName = typoMatch[1]!.trim();
          const typoObj = index.lookupTypography(typoName);
          if (typoObj) {
            for (const [tKey, tVal] of Object.entries(typoObj)) {
              const camelKey = kebabToCamel(tKey);
              additions[camelKey] = resolveValueInner(
                tVal,
                index,
                new Set(),
                diagnostics,
              );
            }
            removals.push(key);
            continue;
          }
        }

        // Normal reference resolution
        recipe.properties[key] = resolveValueInner(
          value,
          index,
          new Set(),
          diagnostics,
        );
      }

      // Apply additions and removals
      for (const key of removals) {
        delete recipe.properties[key];
      }
      Object.assign(recipe.properties, additions);
    }
  }

  // -----------------------------------------------------------------------
  // 2. Resolve references in typed token values
  //    (skip typography — those store serialised JSON objects)
  // -----------------------------------------------------------------------
  const tokenArrays: Array<
    Array<{ name: string; value: string }> | undefined
  > = [
    doc.spec.colorTokens,
    doc.spec.spacingTokens,
    doc.spec.radiusTokens,
    doc.spec.elevationTokens,
    doc.spec.surfaceTokens,
    doc.spec.layoutTokens,
    doc.spec.gradientTokens,
  ];

  for (const tokens of tokenArrays) {
    if (!tokens) continue;
    for (const token of tokens) {
      token.value = resolveValueInner(
        token.value,
        index,
        new Set(),
        diagnostics,
      );
    }
  }

  // Append diagnostics to document
  doc.diagnostics.push(...diagnostics);
}
