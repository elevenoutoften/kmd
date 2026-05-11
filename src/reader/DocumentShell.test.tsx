import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { DocumentShell } from "./DocumentShell";
import type { OutlineEntry } from "../parser";

const reactHookState = vi.hoisted(() => ({
  showOutline: true,
  setStateCalls: [] as Array<(value: boolean) => boolean>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
    useRef: <T,>(value: T) => ({ current: value }),
    useState: (initialValue: boolean) => {
      const setter = (updater: (value: boolean) => boolean) => {
        reactHookState.setStateCalls.push(updater);
      };
      return [initialValue === true ? reactHookState.showOutline : initialValue, setter] as const;
    },
  };
});

const outline: OutlineEntry[] = [
  { id: "intro", text: "Intro", level: 1 },
  { id: "details", text: "Details", level: 2 },
];

describe("DocumentShell", () => {
  beforeEach(() => {
    reactHookState.showOutline = true;
    reactHookState.setStateCalls = [];
  });

  it("renders outline entries", () => {
    const html = renderShell();

    expect(html).toContain("Document outline");
    expect(html).toContain("Intro");
    expect(html).toContain("Details");
    expect(html).toContain('href="#intro"');
    expect(html).toContain('data-depth="1"');
  });

  it("computes outline depth from heading level", () => {
    const deep: OutlineEntry[] = [
      { id: "title", text: "Title", level: 1 },
      { id: "section", text: "Section", level: 2 },
      { id: "subsection", text: "Sub", level: 3 },
      { id: "deep", text: "Deep", level: 4 },
      { id: "deeper", text: "Deeper", level: 5 },
      { id: "deep6", text: "Deep6", level: 6 },
    ];
    const html = renderToStaticMarkup(
      <DocumentShell outline={deep}>
        <p>Content</p>
      </DocumentShell>,
    );

    expect(html).toContain('data-depth="0"');
    expect(html).toContain('data-depth="1"');
    expect(html).toContain('data-depth="2"');
    expect(html).toContain('data-depth="3"');
  });

  it("applies active class when activeId matches", () => {
    const html = renderToStaticMarkup(
      <DocumentShell outline={outline} activeId="details">
        <p>Plain child</p>
      </DocumentShell>,
    );

    expect(html).toContain('class="outline-item active"');
  });

  it("calls onAnchorClick when an outline entry is clicked", () => {
    const onAnchorClick = vi.fn();
    const shell = DocumentShell({
      outline,
      onAnchorClick,
      children: <p>Child content</p>,
    }) as ReactElement;
    const link = findByClassName(shell, "outline-item");

    link.props.onClick({ preventDefault: vi.fn() });

    expect(onAnchorClick).toHaveBeenCalledWith("intro");
  });

  it("toggles the outline visibility state", () => {
    const shell = DocumentShell({ outline, children: <p>Child content</p> }) as ReactElement;
    const button = findByClassName(shell, "outline-toggle");

    expect(button.props.title).toBe("Hide outline");
    expect(button.props.children).toBe("◀");

    button.props.onClick();

    expect(reactHookState.setStateCalls).toHaveLength(1);
    expect(reactHookState.setStateCalls[0]?.(true)).toBe(false);

    reactHookState.showOutline = false;
    const collapsedHtml = renderShell();
    expect(collapsedHtml).toContain("outline-sidebar collapsed");
    expect(collapsedHtml).toContain('title="Show outline"');
    expect(collapsedHtml).toContain("▶");
  });

  it("does not create rendered markdown content", () => {
    const html = renderShell();

    expect(html).toContain("Plain child");
    expect(html).not.toContain("mdr-body");
  });
});

function renderShell(): string {
  return renderToStaticMarkup(
    <DocumentShell outline={outline}>
      <p>Plain child</p>
    </DocumentShell>,
  );
}

function findByClassName(element: ReactElement, className: string): ReactElement {
  const match = findByClassNameOrNull(element, className);
  if (!match) {
    throw new Error(`Unable to find element with class ${className}`);
  }
  return match;
}

function findByClassNameOrNull(element: ReactElement, className: string): ReactElement | null {
  if (typeof element.props.className === "string" && element.props.className.includes(className)) {
    return element;
  }

  const children = element.props.children;
  const childArray = Array.isArray(children) ? children : [children];

  for (const child of childArray) {
    if (isReactElement(child)) {
      const match = findByClassNameOrNull(child, className);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

function isReactElement(value: unknown): value is ReactElement {
  return typeof value === "object" && value !== null && "props" in value;
}
