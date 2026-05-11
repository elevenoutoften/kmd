import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { isTauriRuntime } from "@/utils/platform";

type UpdateStatusHandler = (status: string | null) => void;

export async function checkForAppUpdates(setStatus: UpdateStatusHandler): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    const update = await check();
    if (!update) {
      setStatus(null);
      return;
    }

    const summary = update.body?.trim();
    const prompt = [
      `kmd ${update.version} is available.`,
      summary ? `Release notes:\n${summary}` : null,
      "Install now and restart when it finishes?",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!window.confirm(prompt)) {
      setStatus(null);
      return;
    }

    setStatus(`Installing kmd ${update.version}...`);
    await update.downloadAndInstall();
    setStatus("Restarting kmd...");
    await relaunch();
  } catch (error) {
    console.error("Automatic update check failed", error);
    setStatus(null);
  }
}
