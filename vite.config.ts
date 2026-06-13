import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The "browser" builds of these dependencies touch the DOM at module
      // scope (document.createElement / new DOMParser), which crashes the
      // Markdown parse worker (no DOM in workers) and silently disabled
      // syntax highlighting and Mermaid. Pin the portable builds everywhere.
      "decode-named-character-reference": path.resolve(
        __dirname,
        "node_modules/decode-named-character-reference/index.js"
      ),
      "hast-util-from-html-isomorphic": path.resolve(
        __dirname,
        "node_modules/hast-util-from-html-isomorphic/lib/index.js"
      ),
    },
  },
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          shiki: ["shiki"],
          mermaid: ["mermaid"],
          katex: ["katex"],
        },
      },
    },
  },
  worker: {
    format: "es",
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
