// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { morphMarkdownBody, RAW_IMAGE_SRC_ATTR } from "./domMorph";

function bodyWith(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

describe("morphMarkdownBody", () => {
  it("keeps identical blocks and swaps only the changed ones", () => {
    const container = bodyWith(
      '<h1 id="t">Title</h1><p>Same paragraph</p><pre><code class="language-js">x</code></pre>',
    );
    const keptHeading = container.querySelector("h1");
    const keptParagraph = container.querySelector("p");

    const changed = morphMarkdownBody(
      container,
      '<h1 id="t">Title</h1><p>Same paragraph</p><pre class="shiki-code-block"><code>x</code></pre>',
    );

    expect(changed).toBe(true);
    expect(container.querySelector("h1")).toBe(keptHeading);
    expect(container.querySelector("p")).toBe(keptParagraph);
    expect(container.querySelector("pre")?.className).toBe("shiki-code-block");
  });

  it("reports no change for equivalent markup", () => {
    const container = bodyWith("<p>One</p><p>Two</p>");
    const changed = morphMarkdownBody(container, "<p>One</p><p>Two</p>");
    expect(changed).toBe(false);
  });

  it("treats resolved images as equal to their raw source", () => {
    const container = bodyWith('<p><img src="cat.png" alt="cat"></p>');
    const img = container.querySelector("img");
    if (!img) throw new Error("image missing");

    // Simulate resolveRelativeImages rewriting the src to an inline data URL.
    img.setAttribute(RAW_IMAGE_SRC_ATTR, "cat.png");
    img.setAttribute("src", "data:image/png;base64,AAAA");

    const changed = morphMarkdownBody(container, '<p><img src="cat.png" alt="cat"></p>');

    expect(changed).toBe(false);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "data:image/png;base64,AAAA",
    );
  });

  it("ignores injected copy-hint titles when comparing", () => {
    const container = bodyWith("<p>Use <code>npm test</code> now</p>");
    const code = container.querySelector("code");
    if (!code) throw new Error("code missing");
    code.title = "Click to copy";

    const keptParagraph = container.querySelector("p");
    const changed = morphMarkdownBody(container, "<p>Use <code>npm test</code> now</p>");

    expect(changed).toBe(false);
    expect(container.querySelector("p")).toBe(keptParagraph);
    expect(container.querySelector("code")?.title).toBe("Click to copy");
  });

  it("still replaces blocks whose content genuinely changed", () => {
    const container = bodyWith('<p><img src="cat.png" alt="cat"></p>');
    const img = container.querySelector("img");
    if (!img) throw new Error("image missing");
    img.setAttribute(RAW_IMAGE_SRC_ATTR, "cat.png");
    img.setAttribute("src", "data:image/png;base64,AAAA");

    const changed = morphMarkdownBody(container, '<p><img src="dog.png" alt="dog"></p>');

    expect(changed).toBe(true);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("dog.png");
  });

  it("appends and removes trailing blocks", () => {
    const grew = bodyWith("<p>One</p>");
    expect(morphMarkdownBody(grew, "<p>One</p><p>Two</p>")).toBe(true);
    expect(grew.children).toHaveLength(2);

    const shrank = bodyWith("<p>One</p><p>Two</p>");
    expect(morphMarkdownBody(shrank, "<p>One</p>")).toBe(true);
    expect(shrank.children).toHaveLength(1);
  });
});
