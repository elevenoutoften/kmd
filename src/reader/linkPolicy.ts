export type RenderedLinkAction = "fragment" | "internal" | "external" | "blocked";

const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export interface InternalHrefParts {
  path: string;
  fragment: string | null;
}

function decodeHrefPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function classifyRenderedLink(href: string): RenderedLinkAction {
  const trimmed = href.trim();

  if (trimmed.startsWith("//")) {
    return "external";
  }

  if (
    !trimmed ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return "internal";
  }

  if (trimmed.startsWith("#")) {
    return trimmed.length > 1 ? "fragment" : "internal";
  }

  const protocol = trimmed.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (!protocol) {
    return "internal";
  }

  return SAFE_EXTERNAL_PROTOCOLS.has(`${protocol}:`) ? "external" : "blocked";
}

export function normalizeExternalHref(href: string): string {
  const trimmed = href.trim();
  return trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
}

export function parseInternalHref(href: string): InternalHrefParts {
  const hashIndex = href.indexOf("#");
  const pathPart = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const fragmentPart = hashIndex === -1 ? null : href.slice(hashIndex + 1);

  return {
    path: decodeHrefPart(pathPart),
    fragment: fragmentPart ? decodeHrefPart(fragmentPart) : null,
  };
}

export function getFragmentIdFromHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed.startsWith("#") || trimmed.length <= 1) {
    return null;
  }

  try {
    return decodeURIComponent(trimmed.slice(1));
  } catch {
    return trimmed.slice(1);
  }
}
