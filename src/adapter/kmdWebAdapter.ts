// src/adapter/kmdWebAdapter.ts
//
// The single host adapter that bridges Tauri 2 APIs to the kmd-web
// HostCapabilities interfaces (matching @axis-love/browser 0.1.0).
//
// This is the ONLY file in kmd's shared-reader layer that imports
// @tauri-apps/* packages for reader actions (asset resolution, link
// handling, clipboard, worker creation). No other file under src/reader/
// or src/parser/ should import @tauri-apps/* for reader concerns.
//
// Types are imported from @axis-love/kmd-web (the convenience package)
// which re-exports from @axis-love/contracts and @axis-love/browser.
//
// Rust ownership is preserved: path traversal enforcement, file permission
// decisions, and URL policy all stay in the Rust backend. The adapter only
// invokes Tauri commands and formats the structured safe results returned
// by Rust. It does NOT implement path validation itself.

import { isTauriRuntime } from "@/utils/platform";
import type {
  AssetRequest,
  AssetResolver,
  ClipboardProvider,
  DocumentTarget,
  HostCapabilities,
  LinkHandler,
  ResolvedAsset,
  WorkerFactory,
  WorkerRenderRequest,
  WorkerRenderResponse,
} from "@axis-love/kmd-web";

// Re-export the types that other kmd source files may need
export type {
  AssetRequest,
  AssetResolver,
  ClipboardProvider,
  DocumentTarget,
  HostCapabilities,
  LinkHandler,
  ResolvedAsset,
  WorkerFactory,
  WorkerRenderRequest,
  WorkerRenderResponse,
};

// ---------------------------------------------------------------------------
// kmd-web version pin
// ---------------------------------------------------------------------------

export const KMD_WEB_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Tauri command result types (matching Rust structs in src-tauri/src/commands.rs)
// ---------------------------------------------------------------------------

interface AssetData {
  mime_type: string;
  bytes_base64: string;
}

interface ResolvedLocalPath {
  absolute_path: string;
  is_dir: boolean;
}

// ---------------------------------------------------------------------------
// WorkerLike — local helper interface for the Worker Factory
// ---------------------------------------------------------------------------

/**
 * A worker instance that satisfies the kmd-web WorkerFactory interface.
 * Standard Web Workers have postMessage, addEventListener, removeEventListener,
 * and terminate. The kmd-web WorkerFactory interface only requires postMessage,
 * addEventListener, and terminate — the extra removeEventListener is structurally
 * compatible.
 */
interface WorkerLike {
  postMessage(message: WorkerRenderRequest): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<WorkerRenderResponse>) => void,
  ): void;
  addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<WorkerRenderResponse>) => void,
  ): void;
  removeEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
  terminate(): void;
}

// ---------------------------------------------------------------------------
// AssetResolver
// ---------------------------------------------------------------------------

/**
 * Resolves relative asset paths through Tauri's `resolve_asset` Rust command.
 *
 * Path traversal enforcement and file permission decisions stay in Rust
 * (canonicalize_under_base). The adapter only invokes the command and
 * formats the result as a data: URL for the browser runtime to load.
 *
 * On failure, rejects with a generic error that does not expose file paths.
 */
export function createAssetResolver(): AssetResolver {
  return {
    async resolveAsset(request: AssetRequest): Promise<ResolvedAsset> {
      if (!isTauriRuntime() || !request.documentBase) {
        return { url: request.url, originalUrl: request.url };
      }

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const data = await invoke<AssetData>("resolve_asset", {
          docPath: request.documentBase,
          relativePath: request.url,
        });
        return {
          url: `data:${data.mime_type};base64,${data.bytes_base64}`,
          originalUrl: request.url,
        };
      } catch {
        // Do not expose paths or system details in the error.
        throw new Error("Asset resolution failed");
      }
    },
  };
}

// ---------------------------------------------------------------------------
// LinkHandler
// ---------------------------------------------------------------------------

export interface LinkHandlerConfig {
  /** Returns the current document path (or null when no document is open). */
  getDocPath: () => string | null;
  /** Called when the handler resolves a local Markdown document to open. */
  onOpenDocument?: (path: string, anchor?: string | null) => void;
}

/**
 * Handles link navigation through Tauri:
 * - `openExternal`: opens validated external URLs through the native OS
 *   handler (Tauri's openUrl). Falls back to window.open outside Tauri.
 * - `openDocument`: resolves relative paths through Rust's
 *   `resolve_local_path` command. Directories and non-Markdown files open
 *   through the OS handler (openPath). Markdown files are forwarded to
 *   `onOpenDocument` for in-reader navigation.
 *
 * Core classifies and validates link targets before they reach the handler.
 * The handler does not re-validate URL schemes — it only carries out
 * already-classified actions. Path traversal enforcement stays in Rust.
 *
 * On failure, the handler does not expose paths, execute blocked actions,
 * or blank the document. Errors are silently swallowed.
 */
export function createLinkHandler(config: LinkHandlerConfig): LinkHandler {
  return {
    async openExternal(url: URL): Promise<void> {
      if (!isTauriRuntime()) {
        window.open(url.href, "_blank", "noopener,noreferrer");
        return;
      }

      try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url.href);
      } catch {
        // External link open failed — do not fall back to window.open
        // inside the WebView (security: never navigate the reader to
        // an external URL). The click is silently dropped.
      }
    },

    async openDocument(target: DocumentTarget): Promise<void> {
      const docPath = config.getDocPath();
      if (!docPath || !isTauriRuntime()) return;

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const resolved = await invoke<ResolvedLocalPath>("resolve_local_path", {
          docPath,
          relativePath: target.href,
        });

        if (resolved.is_dir) {
          const { openPath } = await import("@tauri-apps/plugin-opener");
          await openPath(resolved.absolute_path);
          return;
        }

        const lower = resolved.absolute_path.toLowerCase();
        const isMarkdown =
          lower.endsWith(".md") || lower.endsWith(".markdown");

        if (isMarkdown) {
          config.onOpenDocument?.(resolved.absolute_path, target.anchor);
          return;
        }

        // Non-Markdown local file — open through the OS handler.
        const { openPath } = await import("@tauri-apps/plugin-opener");
        await openPath(resolved.absolute_path);
      } catch {
        // Resolution failed (path traversal, missing file, permission).
        // Do not expose paths, execute blocked actions, or blank the
        // document. The click is silently dropped.
      }
    },
  };
}

// ---------------------------------------------------------------------------
// ClipboardProvider
// ---------------------------------------------------------------------------

/**
 * Provides clipboard write access through the Web Clipboard API.
 * Tauri's WebView supports navigator.clipboard.writeText in secure
 * contexts. Falls back to execCommand("copy") for older webviews.
 */
export function createClipboardProvider(): ClipboardProvider {
  return {
    async writeText(value: string): Promise<void> {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(value);
          return;
        } catch {
          // Fall through to execCommand fallback.
        }
      }

      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(textarea);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// WorkerFactory
// ---------------------------------------------------------------------------

/**
 * Creates the Markdown render worker using Tauri's WebView Worker support.
 * The worker is a standard ES module worker — Tauri's WebView handles it
 * natively. The factory returns a WorkerLike that satisfies the kmd-web
 * WorkerFactory interface.
 *
 * The worker uses the kmd-web WorkerBridge protocol: it receives
 * {id, source, options} messages and responds with
 * {type: "result", id, result} or {type: "error", id, error}.
 */
export function createWorkerFactory(): WorkerFactory {
  return {
    createWorker(): WorkerFactory["createWorker"] extends () => infer T ? T : never {
      const worker = new Worker(
        new URL("../parser/parse-worker.ts", import.meta.url),
        { type: "module" },
      );
      return worker as unknown as WorkerLike;
    },
  };
}

// ---------------------------------------------------------------------------
// Full adapter bundle
// ---------------------------------------------------------------------------

export interface KmdWebAdapterOptions {
  getDocPath: () => string | null;
  onOpenDocument?: (path: string, anchor?: string | null) => void;
}

/**
 * Creates the full HostCapabilities bundle for the kmd desktop app.
 * Every capability delegates to Tauri (or the Web platform) for native
 * operations while keeping security policy in Rust.
 */
export function createKmdWebAdapter(options: KmdWebAdapterOptions): HostCapabilities {
  return {
    assetResolver: createAssetResolver(),
    linkHandler: createLinkHandler(options),
    clipboardProvider: createClipboardProvider(),
    workerFactory: createWorkerFactory(),
  };
}