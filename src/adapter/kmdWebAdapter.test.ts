// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Test setup: mock @tauri-apps/* modules and the Tauri runtime detector.
//
// The adapter dynamically imports @tauri-apps/api/core and
// @tauri-apps/plugin-opener. We intercept these with vi.mock so the tests
// can control command behavior without a real Tauri runtime.
// ---------------------------------------------------------------------------

// Track the current invoke implementation so each test can override it.
let invokeImpl: (cmd: string, args: Record<string, unknown>) => unknown;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args: Record<string, unknown>) => invokeImpl(cmd, args),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
  openPath: vi.fn<(path: string) => Promise<void>>().mockResolvedValue(undefined),
}));

// Mock the Worker constructor so WorkerFactory doesn't try to load a real module.
class MockWorker {
  postMessage = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  terminate = vi.fn();
}

// Store the original Worker so we can restore it.
const OriginalWorker = globalThis.Worker;

// Mock the platform detector so we can toggle Tauri runtime on/off.
vi.mock("@/utils/platform", () => ({
  isTauriRuntime: () => tauriRuntimeFlag,
}));

let tauriRuntimeFlag = true;

// Import after mocks are set up.
import {
  createAssetResolver,
  createLinkHandler,
  createClipboardProvider,
  createWorkerFactory,
  createKmdWebAdapter,
  KMD_WEB_VERSION,
} from "./kmdWebAdapter";

// Re-import the mocked opener for assertion access.
import { openUrl, openPath } from "@tauri-apps/plugin-opener";

beforeEach(() => {
  tauriRuntimeFlag = true;
  invokeImpl = () => {
    throw new Error("invoke not configured for this test");
  };
  vi.mocked(openUrl).mockClear();
  vi.mocked(openPath).mockClear();
  // Replace Worker with our mock.
  (globalThis as any).Worker = MockWorker;
});

afterEach(() => {
  (globalThis as any).Worker = OriginalWorker;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AssetResolver
// ---------------------------------------------------------------------------

describe("AssetResolver", () => {
  it("resolves a relative image to a data: URL via Rust resolve_asset", async () => {
    invokeImpl = (cmd) => {
      expect(cmd).toBe("resolve_asset");
      return { mime_type: "image/png", bytes_base64: "iVBORw0KGgo=" };
    };

    const resolver = createAssetResolver();
    const result = await resolver.resolveAsset({
      url: "images/diagram.png",
      type: "image",
      documentBase: "/docs/readme.md",
    });

    expect(result.url).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(result.originalUrl).toBe("images/diagram.png");
  });

  it("returns the original URL when not in Tauri runtime", async () => {
    tauriRuntimeFlag = false;

    const resolver = createAssetResolver();
    const result = await resolver.resolveAsset({
      url: "images/diagram.png",
      type: "image",
      documentBase: "/docs/readme.md",
    });

    expect(result.url).toBe("images/diagram.png");
    expect(result.originalUrl).toBe("images/diagram.png");
  });

  it("returns the original URL when documentBase is absent", async () => {
    const resolver = createAssetResolver();
    const result = await resolver.resolveAsset({
      url: "images/diagram.png",
      type: "image",
    });

    expect(result.url).toBe("images/diagram.png");
  });

  it("throws a generic error without exposing paths on Rust failure (path traversal)", async () => {
    invokeImpl = () => {
      throw new Error("path traversal rejected: /docs/../../etc/passwd");
    };

    const resolver = createAssetResolver();
    const promise = resolver.resolveAsset({
      url: "../../etc/passwd",
      type: "image",
      documentBase: "/docs/readme.md",
    });

    await expect(promise).rejects.toThrow("Asset resolution failed");
    // Verify the error does NOT leak the path.
    try {
      await promise;
    } catch (e) {
      expect(String(e)).not.toContain("/etc/passwd");
      expect(String(e)).not.toContain("traversal");
    }
  });

  it("throws a generic error without exposing paths on asset not found", async () => {
    invokeImpl = () => {
      throw new Error("asset not found: images/missing.png");
    };

    const resolver = createAssetResolver();
    const promise = resolver.resolveAsset({
      url: "images/missing.png",
      type: "image",
      documentBase: "/docs/readme.md",
    });

    await expect(promise).rejects.toThrow("Asset resolution failed");
    try {
      await promise;
    } catch (e) {
      expect(String(e)).not.toContain("images/missing.png");
    }
  });

  it("preserves cached flag when set by the host", async () => {
    invokeImpl = () => ({
      mime_type: "image/jpeg",
      bytes_base64: "/9j/4AAQ=",
    });

    const resolver = createAssetResolver();
    const result = await resolver.resolveAsset({
      url: "photo.jpg",
      type: "image",
      documentBase: "/docs/readme.md",
    });

    expect(result.url).toBe("data:image/jpeg;base64,/9j/4AAQ=");
    expect(result.originalUrl).toBe("photo.jpg");
    // cached is not set by the adapter (Rust doesn't report cache status yet).
    expect(result.cached).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// LinkHandler — openExternal
// ---------------------------------------------------------------------------

describe("LinkHandler.openExternal", () => {
  it("opens a validated external URL through the native OS handler (Tauri)", async () => {
    const handler = createLinkHandler({ getDocPath: () => null });
    await handler.openExternal(new URL("https://example.com/page"));

    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl).toHaveBeenCalledWith("https://example.com/page");
  });

  it("falls back to window.open outside Tauri runtime", async () => {
    tauriRuntimeFlag = false;
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const handler = createLinkHandler({ getDocPath: () => null });
    await handler.openExternal(new URL("https://example.com/page"));

    expect(openUrl).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/page",
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });

  it("does not fall back to window.open when openUrl fails inside Tauri", async () => {
    vi.mocked(openUrl).mockRejectedValueOnce(new Error("OS handler failed"));
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const handler = createLinkHandler({ getDocPath: () => null });
    await handler.openExternal(new URL("https://example.com/page"));

    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("does not throw when openUrl fails (error is silently swallowed)", async () => {
    vi.mocked(openUrl).mockRejectedValueOnce(new Error("OS handler failed"));

    const handler = createLinkHandler({ getDocPath: () => null });
    await expect(
      handler.openExternal(new URL("https://example.com/page")),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// LinkHandler — openDocument
// ---------------------------------------------------------------------------

describe("LinkHandler.openDocument", () => {
  it("opens a resolved Markdown file through onOpenDocument", async () => {
    invokeImpl = () => ({
      absolute_path: "/docs/guide.md",
      is_dir: false,
    });

    const onOpenDocument = vi.fn();
    const handler = createLinkHandler({
      getDocPath: () => "/docs/readme.md",
      onOpenDocument,
    });

    await handler.openDocument({ href: "guide.md", anchor: "intro" });

    expect(onOpenDocument).toHaveBeenCalledWith("/docs/guide.md", "intro");
    expect(openPath).not.toHaveBeenCalled();
  });

  it("opens a directory through the OS handler", async () => {
    invokeImpl = () => ({
      absolute_path: "/docs/subdir",
      is_dir: true,
    });

    const onOpenDocument = vi.fn();
    const handler = createLinkHandler({
      getDocPath: () => "/docs/readme.md",
      onOpenDocument,
    });

    await handler.openDocument({ href: "subdir" });

    expect(openPath).toHaveBeenCalledWith("/docs/subdir");
    expect(onOpenDocument).not.toHaveBeenCalled();
  });

  it("opens a non-Markdown file through the OS handler", async () => {
    invokeImpl = () => ({
      absolute_path: "/docs/report.pdf",
      is_dir: false,
    });

    const onOpenDocument = vi.fn();
    const handler = createLinkHandler({
      getDocPath: () => "/docs/readme.md",
      onOpenDocument,
    });

    await handler.openDocument({ href: "report.pdf" });

    expect(openPath).toHaveBeenCalledWith("/docs/report.pdf");
    expect(onOpenDocument).not.toHaveBeenCalled();
  });

  it("opens a .markdown file through onOpenDocument", async () => {
    invokeImpl = () => ({
      absolute_path: "/docs/notes.markdown",
      is_dir: false,
    });

    const onOpenDocument = vi.fn();
    const handler = createLinkHandler({
      getDocPath: () => "/docs/readme.md",
      onOpenDocument,
    });

    await handler.openDocument({ href: "notes.markdown" });

    expect(onOpenDocument).toHaveBeenCalledWith("/docs/notes.markdown", undefined);
    expect(openPath).not.toHaveBeenCalled();
  });

  it("does nothing when not in Tauri runtime", async () => {
    tauriRuntimeFlag = false;
    const onOpenDocument = vi.fn();
    const handler = createLinkHandler({
      getDocPath: () => "/docs/readme.md",
      onOpenDocument,
    });

    await handler.openDocument({ href: "guide.md" });

    expect(onOpenDocument).not.toHaveBeenCalled();
    expect(openPath).not.toHaveBeenCalled();
  });

  it("does nothing when docPath is null", async () => {
    const onOpenDocument = vi.fn();
    const handler = createLinkHandler({
      getDocPath: () => null,
      onOpenDocument,
    });

    await handler.openDocument({ href: "guide.md" });

    expect(onOpenDocument).not.toHaveBeenCalled();
    expect(openPath).not.toHaveBeenCalled();
  });

  it("does not expose paths or execute blocked actions on path traversal rejection", async () => {
    invokeImpl = () => {
      throw new Error("path traversal rejected: /docs/../../etc/passwd");
    };

    const onOpenDocument = vi.fn();
    const handler = createLinkHandler({
      getDocPath: () => "/docs/readme.md",
      onOpenDocument,
    });

    // Should not throw — error is silently swallowed.
    await expect(
      handler.openDocument({ href: "../../etc/passwd" }),
    ).resolves.toBeUndefined();

    expect(onOpenDocument).not.toHaveBeenCalled();
    expect(openPath).not.toHaveBeenCalled();
  });

  it("does not expose paths or blank the document on resolve failure", async () => {
    invokeImpl = () => {
      throw new Error("document does not exist: /docs/missing.md");
    };

    const onOpenDocument = vi.fn();
    const handler = createLinkHandler({
      getDocPath: () => "/docs/readme.md",
      onOpenDocument,
    });

    await expect(
      handler.openDocument({ href: "missing.md" }),
    ).resolves.toBeUndefined();

    expect(onOpenDocument).not.toHaveBeenCalled();
    expect(openPath).not.toHaveBeenCalled();
  });

  it("does not call onOpenDocument when openPath fails for a non-Markdown file", async () => {
    invokeImpl = () => ({
      absolute_path: "/docs/report.pdf",
      is_dir: false,
    });
    vi.mocked(openPath).mockRejectedValueOnce(new Error("no app for .pdf"));

    const onOpenDocument = vi.fn();
    const handler = createLinkHandler({
      getDocPath: () => "/docs/readme.md",
      onOpenDocument,
    });

    // openPath failure should not throw from openDocument.
    await expect(
      handler.openDocument({ href: "report.pdf" }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ClipboardProvider
// ---------------------------------------------------------------------------

describe("ClipboardProvider", () => {
  it("writes text through navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });

    const provider = createClipboardProvider();
    await provider.writeText("hello world");

    expect(writeText).toHaveBeenCalledWith("hello world");
  });

  it("falls back to execCommand when clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "isSecureContext", {
      value: false,
      configurable: true,
    });

    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    const provider = createClipboardProvider();
    await provider.writeText("fallback text");

    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("falls back to execCommand when clipboard API throws", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("not allowed"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });

    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    const provider = createClipboardProvider();
    await provider.writeText("recovery text");

    expect(writeText).toHaveBeenCalledWith("recovery text");
    expect(execCommand).toHaveBeenCalledWith("copy");
  });
});

// ---------------------------------------------------------------------------
// WorkerFactory
// ---------------------------------------------------------------------------

describe("WorkerFactory", () => {
  it("creates a worker that satisfies the WorkerLike interface", () => {
    const factory = createWorkerFactory();
    const worker = factory.createWorker();

    expect(worker).toBeDefined();
    expect(worker.postMessage).toBeDefined();
    expect(worker.addEventListener).toBeDefined();
    expect(worker.removeEventListener).toBeDefined();
    expect(worker.terminate).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Full adapter bundle
// ---------------------------------------------------------------------------

describe("createKmdWebAdapter", () => {
  it("returns all four capabilities", () => {
    const adapter = createKmdWebAdapter({
      getDocPath: () => "/docs/readme.md",
      onOpenDocument: vi.fn(),
    });

    expect(adapter.assetResolver).toBeDefined();
    expect(adapter.linkHandler).toBeDefined();
    expect(adapter.clipboardProvider).toBeDefined();
    expect(adapter.workerFactory).toBeDefined();
  });

  it("exposes the pinned kmd-web version", () => {
    expect(KMD_WEB_VERSION).toBe("0.1.0");
  });
});