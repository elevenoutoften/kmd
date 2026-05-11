export type RenderedLinkAction = "fragment" | "internal" | "external" | "blocked";

const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

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
