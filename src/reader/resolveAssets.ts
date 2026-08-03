import { RAW_IMAGE_SRC_ATTR } from "./domMorph";
import { createAssetResolver } from "@/adapter/kmdWebAdapter";

export async function resolveRelativeImages(
  container: HTMLElement,
  docPath: string,
): Promise<void> {
  if (!docPath) return;

  const images = container.querySelectorAll<HTMLImageElement>("img[src]");
  if (images.length === 0) return;

  const resolver = createAssetResolver();

  const tasks: Promise<void>[] = [];

  for (const img of images) {
    const src = img.getAttribute("src");
    if (!src) continue;

    if (
      src.startsWith("http:") ||
      src.startsWith("https:") ||
      src.startsWith("data:") ||
      src.startsWith("blob:") ||
      src.startsWith("#")
    ) {
      continue;
    }

    if (src.startsWith("/") && !src.startsWith("//")) {
      continue;
    }

    tasks.push(
      resolver
        .resolveAsset({
          url: src,
          type: "image",
          documentBase: docPath,
        })
        .then((resolved) => {
          // Keep the Markdown-authored src around so DOM morphing can tell
          // a resolved image apart from genuinely changed content.
          img.setAttribute(RAW_IMAGE_SRC_ATTR, src);
          img.src = resolved.url;
        })
        .catch(() => {
          // Leave the original src if resolution fails.
          // The adapter does not expose paths in the error.
        }),
    );
  }

  await Promise.all(tasks);
}