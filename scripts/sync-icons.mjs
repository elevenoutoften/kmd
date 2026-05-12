import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { rewriteIcoFileLargestFirst } from "./ico-utils.mjs";

const repoRoot = process.cwd();
const tauriCliPath = join(repoRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");
const sourceDir = join(repoRoot, "src-tauri", "icons");
const targetDir = sourceDir;
const tempRoot = mkdtempSync(join(tmpdir(), "kmd-icons-"));
const cropOutputDir = join(tempRoot, "crop");
const fullOutputDir = join(tempRoot, "full");

const cropFiles = [
  "32x32.png",
  "64x64.png",
  "128x128.png",
  "128x128@2x.png",
  "icon.png",
  "Square107x107Logo.png",
  "Square142x142Logo.png",
  "Square150x150Logo.png",
  "Square284x284Logo.png",
  "Square30x30Logo.png",
  "Square310x310Logo.png",
  "Square44x44Logo.png",
  "Square71x71Logo.png",
  "Square89x89Logo.png",
  "StoreLogo.png",
];

// Full-source files: only iOS and Android assets need the solid-square source.
// icon.icns is intentionally NOT here — it must use the RGBA crop source so
// macOS gets transparent margins for the system rounded-rect mask.
const fullFiles = [];

function runTauriIcon(inputPath, outputDir) {
  const result = spawnSync(process.execPath, [tauriCliPath, "icon", inputPath, "-o", outputDir], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Icon generation failed for ${inputPath}`);
  }
}

function buildWindowsIco(outputDir, outputPath) {
  cpSync(join(outputDir, "icon.ico"), outputPath, { force: true });

  // Tauri currently decodes the first ICO frame for the runtime window icon on Windows.
  // Keep the largest entry first so the taskbar does not upscale a tiny 16x16 asset.
  rewriteIcoFileLargestFirst(outputPath);
}

try {
  runTauriIcon(join(sourceDir, "IconCrop.png"), cropOutputDir);
  runTauriIcon(join(sourceDir, "IconFull.png"), fullOutputDir);

  for (const file of cropFiles) {
    cpSync(join(cropOutputDir, file), join(targetDir, file), { force: true });
  }

  // icon.icns: use the IconCrop (RGBA) output so macOS gets transparent
  // margins for the system rounded-rect mask.  The previous IconFull source
  // was a solid RGB square which rendered as an uncropped-square icon on
  // Intel Macs.
  cpSync(join(cropOutputDir, "icon.icns"), join(targetDir, "icon.icns"), { force: true });

  buildWindowsIco(cropOutputDir, join(targetDir, "icon.ico"));

  for (const file of fullFiles) {
    cpSync(join(fullOutputDir, file), join(targetDir, file), { force: true });
  }

  cpSync(join(fullOutputDir, "ios"), join(targetDir, "ios"), {
    force: true,
    recursive: true,
  });

  cpSync(join(fullOutputDir, "android"), join(targetDir, "android"), {
    force: true,
    recursive: true,
  });
} finally {
  rmSync(tempRoot, { force: true, recursive: true });
}