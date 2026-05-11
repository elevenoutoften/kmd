import { useEffect, useCallback } from "react";

interface ShortcutHandlers {
  onOpenFile: () => void;
  onPrint: () => void;
}

export function useKeyboardShortcuts({ onOpenFile, onPrint }: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key.toLowerCase()) {
        case "o":
          e.preventDefault();
          onOpenFile();
          break;
        case "p":
          e.preventDefault();
          onPrint();
          break;
      }
    },
    [onOpenFile, onPrint]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
