import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  extractComponents,
  extractComponentsFromContent,
} from "./components";

const FIXTURES = join(__dirname, "../../../../fixtures");

describe("components extractor", () => {
  describe("shopvibe-DESIGN.md", () => {
    const content = readFileSync(join(FIXTURES, "shopvibe-DESIGN.md"), "utf-8");
    const doc = extractComponentsFromContent(content);

    it("extracts component recipes from the Components section", () => {
      const recipes = doc.spec.componentRecipes;
      expect(recipes.length).toBeGreaterThanOrEqual(7);
    });

    it("extracts button recipes with family property", () => {
      const recipes = doc.spec.componentRecipes;
      const buttons = recipes.filter((r) => r.properties.family === "button");
      expect(buttons.length).toBe(3);

      const names = buttons.map((b) => b.name);
      expect(names).toContain("Primary");
      expect(names).toContain("Secondary");
      expect(names).toContain("Ghost");
    });

    it("extracts Primary button with background from hex", () => {
      const primary = doc.spec.componentRecipes.find(
        (r) => r.name === "Primary" && r.properties.family === "button",
      );
      expect(primary).toBeDefined();
      expect(primary!.properties["background"]).toBe("#D946EF");
    });

    it("extracts Secondary button with border and transparent background", () => {
      const secondary = doc.spec.componentRecipes.find(
        (r) => r.name === "Secondary" && r.properties.family === "button",
      );
      expect(secondary).toBeDefined();
      expect(secondary!.properties.background).toBe("transparent");
      expect(secondary!.properties["border-width"]).toBe("1px");
    });

    it("extracts Ghost button with transparent background and no border", () => {
      const ghost = doc.spec.componentRecipes.find(
        (r) => r.name === "Ghost" && r.properties.family === "button",
      );
      expect(ghost).toBeDefined();
      expect(ghost!.properties.background).toBe("transparent");
      expect(ghost!.properties.border).toBe("none");
    });

    it("extracts card recipes", () => {
      const cards = doc.spec.componentRecipes.filter(
        (r) => r.properties.family === "card",
      );
      expect(cards.length).toBe(2);

      const names = cards.map((c) => c.name);
      expect(names).toContain("Product Card");
      expect(names).toContain("Feature Card");
    });

    it("extracts Product Card with radius", () => {
      const card = doc.spec.componentRecipes.find(
        (r) => r.name === "Product Card",
      );
      expect(card).toBeDefined();
      expect(card!.properties.radius).toBe("12");
    });

    it("extracts input recipes", () => {
      const inputs = doc.spec.componentRecipes.filter(
        (r) => r.properties.family === "input",
      );
      expect(inputs.length).toBe(2);

      const names = inputs.map((i) => i.name);
      expect(names).toContain("Text Input");
      expect(names).toContain("Search Input");
    });

    it("extracts Text Input inline props (ShopVibe format)", () => {
      const textInput = doc.spec.componentRecipes.find(
        (r) => r.name === "Text Input" && r.properties.family === "input",
      );
      expect(textInput).toBeDefined();
      expect(textInput!.properties.background).toBe("#FFFFFF");
      expect(textInput!.properties.border).toBe("1.5px solid #D4D4D4");
      expect(textInput!.properties.radius).toBe("4px");
      expect(textInput!.properties.padding).toBe("12px 16px");
      expect(textInput!.properties.height).toBe("44px");
      expect(textInput!.properties.foreground).toBe("#17191C");
      expect(textInput!.properties["placeholder-color"]).toBe("#9CA3AF");
    });

    it("extracts Text Input hover color from inline format", () => {
      const textInput = doc.spec.componentRecipes.find(
        (r) => r.name === "Text Input" && r.properties.family === "input",
      );
      expect(textInput).toBeDefined();
      expect(textInput!.properties["hover-background"]).toBe("#C026D3");
    });

    it("extracts Text Input focus ring from inline format", () => {
      const textInput = doc.spec.componentRecipes.find(
        (r) => r.name === "Text Input" && r.properties.family === "input",
      );
      expect(textInput).toBeDefined();
      expect(textInput!.properties["focus-ring"]).toBe("#D946EF");
    });

    it("extracts Primary button hover color from inline format in inputs", () => {
      const textInput = doc.spec.componentRecipes.find(
        (r) => r.name === "Text Input" && r.properties.family === "input",
      );
      expect(textInput).toBeDefined();
      expect(textInput!.properties["hover-background"]).toBe("#C026D3");
    });

    it("sets provenance.extractor to 'component'", () => {
      for (const recipe of doc.spec.componentRecipes) {
        expect(recipe.provenance.extractor).toBe("component");
        expect(recipe.provenance.sourceLine).toBeGreaterThan(0);
      }
    });
  });

  describe("thoughtstream-DESIGN.md", () => {
    const content = readFileSync(join(FIXTURES, "thoughtstream-DESIGN.md"), "utf-8");
    const doc = extractComponentsFromContent(content);

    it("extracts input recipes with family property", () => {
      const inputs = doc.spec.componentRecipes.filter(
        (r) => r.properties.family === "input",
      );
      expect(inputs.length).toBeGreaterThanOrEqual(1);
    });

    it("extracts Text Input from bullet-list properties", () => {
      const textInput = doc.spec.componentRecipes.find(
        (r) => r.name === "Text Input" && r.properties.family === "input",
      );
      expect(textInput).toBeDefined();
      expect(textInput!.properties.height).toBe("48px");
      expect(textInput!.properties.background).toBe("#FAFAF9");
      expect(textInput!.properties.foreground).toBe("#1C1917");
      expect(textInput!.properties.border).toBe("1px solid #D6D3D1");
      expect(textInput!.properties.radius).toBe("0px");
      expect(textInput!.properties.padding).toBe("12px 16px");
      expect(textInput!.properties["placeholder-color"]).toBe("#A8A29E");
    });

    it("extracts Text Input focus ring from bullet list", () => {
      const textInput = doc.spec.componentRecipes.find(
        (r) => r.name === "Text Input" && r.properties.family === "input",
      );
      expect(textInput).toBeDefined();
      expect(textInput!.properties["focus-ring"]).toBe("#D946EF");
    });

    it("extracts button recipes with family property", () => {
      const buttons = doc.spec.componentRecipes.filter(
        (r) => r.properties.family === "button",
      );
      expect(buttons.length).toBe(2);
    });

    it("extracts Primary button from bullet-list properties", () => {
      const primary = doc.spec.componentRecipes.find(
        (r) => r.name === "Primary" && r.properties.family === "button",
      );
      expect(primary).toBeDefined();
      expect(primary!.properties.background).toBe("#57534E");
      expect(primary!.properties.foreground).toBe("#FFFFFF");
      expect(primary!.properties.border).toBe("1px solid #57534E");
      expect(primary!.properties.radius).toBe("0px");
      expect(primary!.properties.padding).toBe("12px 24px");
      expect(primary!.properties.height).toBe("48px");
    });

    it("extracts Primary button hover background (ThoughtStream format)", () => {
      const primary = doc.spec.componentRecipes.find(
        (r) => r.name === "Primary" && r.properties.family === "button",
      );
      expect(primary).toBeDefined();
      expect(primary!.properties["hover-background"]).toBe("#78716C");
    });

    it("extracts Primary button focus ring from bullet list", () => {
      const primary = doc.spec.componentRecipes.find(
        (r) => r.name === "Primary" && r.properties.family === "button",
      );
      expect(primary).toBeDefined();
      expect(primary!.properties["focus-ring"]).toBe("#D946EF");
    });

    it("extracts card recipes", () => {
      const cards = doc.spec.componentRecipes.filter(
        (r) => r.properties.family === "card",
      );
      expect(cards.length).toBe(1);
      expect(cards[0]!.name).toBe("Journal Card");
      expect(cards[0]!.properties.background).toBe("#FFFFFF");
      expect(cards[0]!.properties.border).toBe("1px solid #D6D3D1");
      expect(cards[0]!.properties.radius).toBe("8px");
      expect(cards[0]!.properties.padding).toBe("24px");
    });
  });

  describe("no component content", () => {
    const content = readFileSync(join(FIXTURES, "apple-DESIGN.md"), "utf-8");
    const doc = extractComponentsFromContent(content);

    it("produces empty componentRecipes when no components found", () => {
      expect(doc.spec.componentRecipes).toHaveLength(0);
    });
  });

  describe("convenience wrapper", () => {
    it("returns a valid DesignDocument", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Primary**: bg: #D946EF, white text, pill shape",
      );
      expect(doc.spec.componentRecipes.length).toBeGreaterThanOrEqual(1);
      expect(doc.diagnostics).toHaveLength(0);
    });
  });

  describe("border shorthand normalization", () => {
    it("converts '1.5px #D4D4D4' to '1.5px solid #D4D4D4'", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Inputs\n- **Field**: `border: 1.5px #D4D4D4`, `padding: 8px 12px`",
      );
      const field = doc.spec.componentRecipes.find((r) => r.name === "Field");
      expect(field).toBeDefined();
      expect(field!.properties.border).toBe("1.5px solid #D4D4D4");
    });

    it("preserves already-valid '1px solid #D6D3D1'", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Inputs\n- **Field**: `border: 1px solid #D6D3D1`",
      );
      const field = doc.spec.componentRecipes.find((r) => r.name === "Field");
      expect(field).toBeDefined();
      expect(field!.properties.border).toBe("1px solid #D6D3D1");
    });
  });

  describe("key normalization", () => {
    it("maps backgroundColor/bg/background-color to background", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Btn**: `bg: #FF0000`, `padding: 8px`",
      );
      const btn = doc.spec.componentRecipes.find((r) => r.name === "Btn");
      expect(btn).toBeDefined();
      expect(btn!.properties.background).toBe("#FF0000");
    });

    it("maps textColor/foreground/text to foreground", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Btn**: `text: #000000`, `padding: 8px`",
      );
      const btn = doc.spec.componentRecipes.find((r) => r.name === "Btn");
      expect(btn).toBeDefined();
      expect(btn!.properties.foreground).toBe("#000000");
    });

    it("maps borderRadius/rounded to radius", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Btn**: `rounded: 12px`, `padding: 8px`",
      );
      const btn = doc.spec.componentRecipes.find((r) => r.name === "Btn");
      expect(btn).toBeDefined();
      expect(btn!.properties.radius).toBe("12px");
    });

    it("maps hover-background/hover-bg/hover-color to hover-background", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Btn**: `hover-bg: #333`, `padding: 8px`",
      );
      const btn = doc.spec.componentRecipes.find((r) => r.name === "Btn");
      expect(btn).toBeDefined();
      expect(btn!.properties["hover-background"]).toBe("#333");
    });

    it("maps focus-ring/focus-border to focus-ring", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Inputs\n- **Field**: `focus-ring: #007AFF`, `padding: 8px`",
      );
      const field = doc.spec.componentRecipes.find((r) => r.name === "Field");
      expect(field).toBeDefined();
      expect(field!.properties["focus-ring"]).toBe("#007AFF");
    });

    it("maps placeholder/placeholder-color to placeholder-color", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Inputs\n- **Field**: `placeholder: #999`, `padding: 8px`",
      );
      const field = doc.spec.componentRecipes.find((r) => r.name === "Field");
      expect(field).toBeDefined();
      expect(field!.properties["placeholder-color"]).toBe("#999");
    });
  });

  describe("hover extraction patterns", () => {
    it("extracts hover: #C026D3 (hex after colon)", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Primary**: Fuchsia background, hover: #C026D3",
      );
      const primary = doc.spec.componentRecipes.find((r) => r.name === "Primary");
      expect(primary).toBeDefined();
      expect(primary!.properties["hover-background"]).toBe("#C026D3");
    });

    it("extracts Hover: Background #57534E", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Primary**: Background #57534E. Hover: Background #78716C",
      );
      const primary = doc.spec.componentRecipes.find((r) => r.name === "Primary");
      expect(primary).toBeDefined();
      expect(primary!.properties["hover-background"]).toBe("#78716C");
    });
  });

  describe("focus extraction patterns", () => {
    it("extracts focus: border #D946EF", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Inputs\n- **Field**: focus: border #D946EF, padding: 8px",
      );
      const field = doc.spec.componentRecipes.find((r) => r.name === "Field");
      expect(field).toBeDefined();
      expect(field!.properties["focus-ring"]).toBe("#D946EF");
    });

    it("extracts focus: border #X, ring 3px #Y", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Inputs\n- **Field**: focus: border #D946EF, ring 3px #D946EF",
      );
      const field = doc.spec.componentRecipes.find((r) => r.name === "Field");
      expect(field).toBeDefined();
      expect(field!.properties["focus-ring"]).toBe("#D946EF");
      expect(field!.properties["focus-ring-width"]).toBe("3px");
    });
  });

  describe("bold paragraph + bullet list format", () => {
    it("extracts component with sub-bullet properties", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Primary**\n  - Height: 48px\n  - Background: `#57534E`\n  - Radius: 0px\n  - Hover: Background `#78716C`",
      );
      const primary = doc.spec.componentRecipes.find((r) => r.name === "Primary");
      expect(primary).toBeDefined();
      expect(primary!.properties.height).toBe("48px");
      expect(primary!.properties.background).toBe("#57534E");
      expect(primary!.properties.radius).toBe("0px");
    });
  });

  describe("radius normalization", () => {
    it("normalizes 'Radius: 0px' to '0px'", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Primary**: bg: #57534E, radius: 0px",
      );
      const primary = doc.spec.componentRecipes.find((r) => r.name === "Primary");
      expect(primary).toBeDefined();
      expect(primary!.properties.radius).toBe("0px");
    });

    it("normalizes 'Radius: none' to '0px'", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Primary**: bg: #57534E, radius: none",
      );
      const primary = doc.spec.componentRecipes.find((r) => r.name === "Primary");
      expect(primary).toBeDefined();
      expect(primary!.properties.radius).toBe("0px");
    });

    it("normalizes 'Radius: 0' to '0px'", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Primary**: bg: #57534E, radius: 0",
      );
      const primary = doc.spec.componentRecipes.find((r) => r.name === "Primary");
      expect(primary).toBeDefined();
      expect(primary!.properties.radius).toBe("0px");
    });

    it("preserves non-zero radius values", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Primary**: bg: #57534E, radius: 12px",
      );
      const primary = doc.spec.componentRecipes.find((r) => r.name === "Primary");
      expect(primary).toBeDefined();
      expect(primary!.properties.radius).toBe("12px");
    });

    it("extracts 0px radius from bullet-list format", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Primary**\n  - Radius: 0px\n  - Background: `#57534E`",
      );
      const primary = doc.spec.componentRecipes.find((r) => r.name === "Primary");
      expect(primary).toBeDefined();
      expect(primary!.properties.radius).toBe("0px");
    });

    it("extracts 'none' radius from bullet-list and normalizes to 0px", () => {
      const doc = extractComponentsFromContent(
        "## Components\n### Buttons\n- **Primary**\n  - Radius: none\n  - Background: `#57534E`",
      );
      const primary = doc.spec.componentRecipes.find((r) => r.name === "Primary");
      expect(primary).toBeDefined();
      expect(primary!.properties.radius).toBe("0px");
    });
  });
});
