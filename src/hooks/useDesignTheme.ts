import { DesignThemeController, type DesignThemeInfo } from "@axis-love/browser";
import { useEffect } from "react";
import { isTauriRuntime } from "@/utils/platform";

/**
 * Apply a user-supplied designMD theme (KMD_DESIGN_MD env var, or DESIGN.md
 * next to the executable) to the whole window for the app's lifetime.
 *
 * Owned by the app shell, not the Reader: the overrides are scoped at <html>
 * so the chrome (toolbar, welcome screen, outline, toasts) resolves its
 * --color-* aliases against the custom tokens, and they must survive the
 * Reader unmounting (welcome screen, Design tab). Non-fatal by contract: a
 * missing or invalid theme leaves the default themes untouched.
 */
export function useDesignTheme(onInfo?: (info: DesignThemeInfo) => void): void {
  useEffect(() => {
    if (!isTauriRuntime()) return;

    const controller = new DesignThemeController(document.documentElement, onInfo);
    let active = true;

    void (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const source = await invoke<string | null>("load_design_theme");
        if (active && source) await controller.apply(source);
      } catch {
        // No theme, or the command is unavailable — defaults apply.
      }
    })();

    return () => {
      active = false;
      controller.dispose();
    };
    // The theme file is read once per app launch; onInfo is a reporting hook only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
