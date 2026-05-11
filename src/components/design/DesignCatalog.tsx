import { useEffect, type ReactElement } from "react";
import type { OutlineEntry } from "@/parser";
import type {
  ColorToken,
  ComponentRecipe,
  DesignDocument,
  TypographyToken,
} from "@/parser/design";
import {
  buildShowcaseCSS,
  collectDesignFontFamilyNames,
  buildGoogleFontStylesheetUrl,
  getTypography,
  withFontFallback,
  inferFontGeneric,
  sanitizeFontFamilyName,
  quoteFontFamily,
} from "./showcaseTheme";
import "./DesignCatalog.css";

interface DesignCatalogProps {
  doc: DesignDocument;
}

export function DesignCatalog({ doc }: DesignCatalogProps): ReactElement {
  const name = doc.meta.name || "Design System";
  const colorTokens = doc.spec.colorTokens ?? [];
  const typographyTokens = doc.spec.typographyTokens ?? [];
  const recipes = doc.spec.componentRecipes ?? [];
  const cards = recipes.filter(isCardRecipe);

  const tokenCount = colorTokens.length + typographyTokens.length + (doc.spec.spacingTokens?.length ?? 0) + (doc.spec.radiusTokens?.length ?? 0) + (doc.spec.elevationTokens?.length ?? 0) + (doc.spec.surfaceTokens?.length ?? 0) + (doc.spec.layoutTokens?.length ?? 0);
  const componentCount = recipes.length;
  const coveragePercent = colorTokens.length > 0 ? Math.min(100, Math.round((colorTokens.length / 14) * 100)) : 0;

  const showcaseCSS = buildShowcaseCSS(doc);
  const webFontFamilies = collectDesignFontFamilyNames(doc);

  return (
    <>
      {showcaseCSS ? <style>{showcaseCSS}</style> : null}
      <DesignWebFontLoader families={webFontFamilies} />
      <div className="nyx-showcase">
        <div className="nyx-hero">
          <div className="nyx-container">
            <h1>{name}</h1>
            <p className="nyx-subtitle">Component Showcase</p>
            <p className="nyx-meta">
              {tokenCount} Tokens · {componentCount} Components · Fully Responsive
            </p>
          </div>
        </div>

        <div className="nyx-container">
          <div className="nyx-callout">
            <p>
              <strong>About this page:</strong> This showcase demonstrates every
              building block of the {name} — typography scales, color tokens, card
              patterns, data tables, badges, and interactive elements. Each section
              highlights a different facet of the system.
            </p>
          </div>

          <DesignTokensSection doc={doc} typographyTokens={typographyTokens} />

          <StatsAndCardsSection
            tokenCount={tokenCount}
            componentCount={componentCount}
            coveragePercent={coveragePercent}
            cards={cards}
          />

          {colorTokens.length > 0 ? (
            <DataTableSection tokens={colorTokens} />
          ) : null}
        </div>
      </div>
    </>
  );
}

function DesignWebFontLoader({
  families,
}: {
  families: readonly string[];
}): null {
  const familyKey = families.join("\0");

  useEffect(() => {
    if (typeof document === "undefined") return;

    const pendingFamilies = familyKey ? familyKey.split("\0") : [];
    for (const family of pendingFamilies) {
      const url = buildGoogleFontStylesheetUrl(family);
      if (!url || isFontProbablyInstalled(family)) continue;

      const id = `kmd-design-font-${hashString(url)}`;
      if (document.getElementById(id)) continue;

      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.kmdDesignFont = family;
      document.head.appendChild(link);
    }
  }, [familyKey]);

  return null;
}

function isFontProbablyInstalled(family: string): boolean {
  if (typeof document === "undefined") return false;

  const safe = sanitizeFontFamilyName(family);
  if (!safe) return false;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return false;

  const text = "mmmmmmmmmmlliWWWWW";
  return ["serif", "sans-serif", "monospace"].some((base) => {
    context.font = `72px ${base}`;
    const fallbackWidth = context.measureText(text).width;
    context.font = `72px ${quoteFontFamily(safe)}, ${base}`;
    return context.measureText(text).width !== fallbackWidth;
  });
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function DesignTokensSection({
  doc,
  typographyTokens,
}: {
  doc: DesignDocument;
  typographyTokens: TypographyToken[];
}): ReactElement {
  return (
    <div className="nyx-section" id="showcase-tokens">
      <p className="nyx-section-label">Component Library</p>
      <h2>Design tokens in action</h2>
      <p className="nyx-section-desc">
        A quick tour of typography scale, interactive states, and semantic color
        usage across the system.
      </p>
      <div className="nyx-grid-2">
        <div className="nyx-card">
          <h3>Typography</h3>
          <p style={{ marginBottom: 16 }}>
            The type scale spans from delicate labels to commanding display
            headings. Every weight and size is calibrated for clear legibility
            across both themes.
          </p>
          <div className="nyx-typo-specimens">
            {typographyTokens.length > 0 ? (
              typographyTokens.slice(0, 5).map((token) => (
                <TypographySpecimen key={token.name} doc={doc} token={token} />
              ))
            ) : (
              <>
                <div style={{ fontSize: 32, fontWeight: 600, color: "var(--nyx-text-head)", letterSpacing: "-0.02em" }}>Display heading</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "var(--nyx-text-head)" }}>Section heading</div>
                <div style={{ fontSize: 15, color: "var(--nyx-text-body)" }}>Body text — readable and calm at 15px with 1.47 line-height.</div>
                <div style={{ fontSize: 13, color: "var(--nyx-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Label — uppercase, muted</div>
                <div style={{ fontSize: 11, color: "var(--nyx-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dim caption — 11px, sparse</div>
              </>
            )}
          </div>
        </div>

        <div className="nyx-card">
          <h3>Tags, Badges &amp; Buttons</h3>
          <p style={{ marginBottom: 16 }}>
            Interactive and semantic elements use the accent, positive, warning,
            and neutral palettes with consistent padding and radius.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            <span className="nyx-badge nyx-badge-accent">Accent</span>
            <span className="nyx-badge nyx-badge-positive">Positive</span>
            <span className="nyx-badge nyx-badge-warning">Warning</span>
            <span className="nyx-badge nyx-badge-neutral">Neutral</span>
            <span className="nyx-tag nyx-tag-accent">Tag accent</span>
            <span className="nyx-tag nyx-tag-neutral">Tag neutral</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            <button className="nyx-btn nyx-btn-primary" type="button">Primary button</button>
            <button className="nyx-btn nyx-btn-secondary" type="button">Secondary</button>
            <button className="nyx-btn nyx-btn-ghost" type="button">Ghost link</button>
          </div>
          <div className="nyx-field">
            <label className="nyx-input-label">Label</label>
            <input
              className="nyx-input-control"
              type="text"
              readOnly
              placeholder="Placeholder text"
            />
            <span className="nyx-input-helper">Helper text</span>
          </div>
        </div>
      </div>
      <hr className="nyx-sep" />
    </div>
  );
}

function StatsAndCardsSection({
  tokenCount,
  componentCount,
  coveragePercent,
  cards,
}: {
  tokenCount: number;
  componentCount: number;
  coveragePercent: number;
  cards: ComponentRecipe[];
}): ReactElement {
  return (
    <div className="nyx-section" id="showcase-components">
      <p className="nyx-section-label">Card Patterns</p>
      <h2>Flexible layouts for any content</h2>
      <p className="nyx-section-desc">
        From single-value metric highlights to rich content blocks with badges
        and metadata.
      </p>
      <div className="nyx-grid-3" style={{ marginBottom: 20 }}>
        <div className="nyx-stat-card">
          <span className="nyx-stat-label">Design Tokens</span>
          <span className="nyx-stat-value">{tokenCount}</span>
          <span className="nyx-stat-delta positive">Extracted</span>
        </div>
        <div className="nyx-stat-card">
          <span className="nyx-stat-label">Components</span>
          <span className="nyx-stat-value">{componentCount}</span>
          <span className="nyx-stat-delta positive">Detected</span>
        </div>
        <div className="nyx-stat-card">
          <span className="nyx-stat-label">Color Coverage</span>
          <span className="nyx-stat-value">{coveragePercent}%</span>
          <span className="nyx-stat-delta positive">Mapped</span>
        </div>
      </div>
      {cards.length > 0 ? (
        <div className="nyx-grid-3">
          {cards.slice(0, 3).map((recipe, i) => (
            <div className={`nyx-card${i === 0 ? " highlight" : ""}`} key={recipe.name}>
              <span
                className={`nyx-badge ${i === 0 ? "nyx-badge-accent" : i === 1 ? "nyx-badge-positive" : "nyx-badge-warning"}`}
                style={{ marginBottom: 14, display: "inline-block" }}
              >
                {i === 0 ? "Active" : i === 1 ? "On Track" : "At Risk"}
              </span>
              <h3>{cleanRecipeName(recipe.name)}</h3>
              <p>
                A {cleanRecipeName(recipe.name).toLowerCase()} component with{" "}
                {Object.keys(recipe.properties).length} configurable properties
                for flexible layout and styling.
              </p>
              <p className="nyx-card-meta">
                Properties: {Object.keys(recipe.properties).length} &nbsp;·&nbsp;
                Source: {recipe.provenance.extractor}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="nyx-grid-3">
          <div className="nyx-card highlight">
            <span className="nyx-badge nyx-badge-accent" style={{ marginBottom: 14, display: "inline-block" }}>Active</span>
            <h3>Design Tokens</h3>
            <p>The core set of design decisions — colors, typography, spacing — that define the visual language of the system.</p>
            <p className="nyx-card-meta">Category: Foundation &nbsp;·&nbsp; Count: {tokenCount}</p>
          </div>
          <div className="nyx-card">
            <span className="nyx-badge nyx-badge-positive" style={{ marginBottom: 14, display: "inline-block" }}>Complete</span>
            <h3>Components</h3>
            <p>Reusable UI building blocks composed from design tokens, ensuring consistency across the entire interface.</p>
            <p className="nyx-card-meta">Items: {componentCount} &nbsp;·&nbsp; Status: Mapped</p>
          </div>
          <div className="nyx-card">
            <span className="nyx-badge nyx-badge-warning" style={{ marginBottom: 14, display: "inline-block" }}>In Progress</span>
            <h3>Layout System</h3>
            <p>Grid and spacing patterns that adapt responsively, maintaining visual rhythm across screen sizes.</p>
            <p className="nyx-card-meta">Breakpoints: 3 &nbsp;·&nbsp; Priority: High</p>
          </div>
        </div>
      )}
      <hr className="nyx-sep" />
    </div>
  );
}

function deterministicScore(index: number, total: number): number {
  const threshold1 = Math.floor(total * 0.6);
  const threshold2 = Math.floor(total * 0.85);

  const statusIndex = index < threshold1 ? 0 : index < threshold2 ? 1 : 2;

  const baseScore = 70 + Math.round(index * 2.5);
  const bump = statusIndex === 0 ? 8 : statusIndex === 1 ? 4 : 0;

  return Math.min(99, baseScore + bump);
}

function DataTableSection({ tokens }: { tokens: ColorToken[] }): ReactElement {
  return (
    <div className="nyx-section" id="showcase-inventory">
      <p className="nyx-section-label">Component Catalog</p>
      <h2>Design token inventory</h2>
      <p className="nyx-section-desc">
        A snapshot of the current component library — coverage, status, and
        completeness scores.
      </p>

      <div className="nyx-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Element</th>
              <th>Category</th>
              <th>Color</th>
              <th>Role</th>
              <th>Status</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token, i) => {
              const score = deterministicScore(i, tokens.length);
              const threshold1 = Math.floor(tokens.length * 0.6);
              const threshold2 = Math.floor(tokens.length * 0.85);
              return (
                <tr key={token.name}>
                  <td className="nyx-col-name">{token.name}</td>
                  <td>{token.group || "Other"}</td>
                  <td>
                    <span
                      className="nyx-table-swatch"
                      style={{ backgroundColor: token.value }}
                    />
                  </td>
                  <td>{token.role || "—"}</td>
                  <td>
                    <span
                      className={`nyx-badge ${
                        i < threshold1
                          ? "nyx-badge-positive"
                          : i < threshold2
                            ? "nyx-badge-accent"
                            : "nyx-badge-neutral"
                      }`}
                    >
                      {i < threshold1 ? "Complete" : i < threshold2 ? "In Progress" : "Planned"}
                    </span>
                  </td>
                  <td className="nyx-col-score">
                    {score}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="nyx-mobile-cards">
        {tokens.map((token, i) => {
          const score = deterministicScore(i, tokens.length);
          return (
            <div className="nyx-m-card" key={token.name}>
              <div className="nyx-m-name">{token.name}</div>
              <div className="nyx-m-score">
                Score: {score}
              </div>
              <div className="nyx-m-rows">
                <div className="nyx-m-row">
                  <label>Category</label>
                  <span>{token.group || "Other"}</span>
                </div>
                <div className="nyx-m-row">
                  <label>Color</label>
                  <span className="nyx-table-swatch" style={{ backgroundColor: token.value }} />
                </div>
                <div className="nyx-m-row">
                  <label>Role</label>
                  <span>{token.role || "—"}</span>
                </div>
                <div className="nyx-m-row">
                  <label>Status</label>
                  <span>{i < Math.floor(tokens.length * 0.6) ? "Complete" : "Planned"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TypographySpecimen({
  doc,
  token,
}: {
  doc: DesignDocument;
  token: TypographyToken;
}): ReactElement {
  const typo = getTypography(doc, token);
  const style: Record<string, string> = {};
  if (typo.fontSize) style.fontSize = `${typo.fontSize}px`;
  if (typo.fontWeight) style.fontWeight = typo.fontWeight;
  if (typo.lineHeight) style.lineHeight = typo.lineHeight;
  if (typo.letterSpacing) style.letterSpacing = typo.letterSpacing;
  if (typo.fontFamily) {
    const family = withFontFallback(
      typo.fontFamily,
      inferFontGeneric(typo.fontFamily, "sans-serif"),
    );
    if (family) style.fontFamily = family;
  }

  const size = typo.fontSize ?? 0;
  let text: string;
  if (size >= 36) text = "Display heading";
  else if (size >= 20) text = "Section heading";
  else if (size >= 15) text = "Body text — readable and calm.";
  else text = "LABEL — UPPERCASE, MUTED";

  return (
    <div className="nyx-typo-row" style={style}>
      {text}
    </div>
  );
}

export function catalogOutline(doc: DesignDocument): OutlineEntry[] {
  const sections: OutlineEntry[] = [];
  sections.push({ id: "showcase-tokens", text: "Tokens", level: 1 });
  sections.push({ id: "showcase-components", text: "Components", level: 1 });
  const colorTokens = doc.spec.colorTokens ?? [];
  if (colorTokens.length > 0) {
    sections.push({ id: "showcase-inventory", text: "Inventory", level: 1 });
  }
  return sections;
}

const CARD_RE = /card|tile|panel/i;

function isCardRecipe(recipe: ComponentRecipe): boolean {
  return CARD_RE.test(recipe.name) || recipe.properties.family === "card";
}

function cleanRecipeName(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export { buildShowcaseCSS, collectDesignFontFamilyNames, buildGoogleFontStylesheetUrl };