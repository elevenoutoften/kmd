import { isTauriRuntime } from "@/utils/platform";
import { RAW_IMAGE_SRC_ATTR } from "./domMorph";

interface AssetData {
  mime_type: string;
  bytes_base64: string;
}

export async function resolveRelativeImages(
  container: HTMLElement,
  docPath: string
): Promise<void> {
  if (!isTauriRuntime() || !docPath) return;

  const images = container.querySelectorAll<HTMLImageElement>("img[src]");
  if (images.length === 0) return;

  const { invoke } = await import("@tauri-apps/api/core");

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
      invoke<AssetData>("resolve_asset", {
        docPath,
        relativePath: src,
      })
        .then((data) => {
          // Keep the Markdown-authored src around so DOM morphing can tell
          // a resolved image apart from genuinely changed content.
          img.setAttribute(RAW_IMAGE_SRC_ATTR, src);
          img.src = `data:${data.mime_type};base64,${data.bytes_base64}`;
        })
        .catch(() => {
          // Leave the original src if resolution fails
        })
    );
  }

  await Promise.all(tasks);
}
