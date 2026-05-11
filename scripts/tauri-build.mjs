import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { readFileSync as readSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

const env = { ...process.env };
const defaultKeyPath = join(homedir(), ".tauri", "kmd-updater.key");
const defaultCargoBinPath = join(homedir(), ".cargo", "bin");
const defaultNodeBinPath = dirname(process.execPath);
const tauriCliPath = join(process.cwd(), "node_modules", "@tauri-apps", "cli", "tauri.js");
const syncIconsPath = join(process.cwd(), "scripts", "sync-icons.mjs");
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "Path";
const tauriArgs = process.argv.slice(2);

if (!env.TAURI_SIGNING_PRIVATE_KEY && !env.TAURI_SIGNING_PRIVATE_KEY_PATH && existsSync(defaultKeyPath)) {
  env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(defaultKeyPath, "utf8");
}

const hasSigningKey = !!env.TAURI_SIGNING_PRIVATE_KEY;

if (!hasSigningKey) {
  console.warn("Tauri updater signing key not found — building without updater artifacts.");
  console.warn(`Set TAURI_SIGNING_PRIVATE_KEY or place a key at ${defaultKeyPath} to enable updater signing.`);
}

if (!("TAURI_SIGNING_PRIVATE_KEY_PASSWORD" in env)) {
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "";
}

const pathEntries = (env[pathKey] ?? "").split(delimiter).filter(Boolean);
if (!pathEntries.includes(defaultNodeBinPath)) {
  pathEntries.unshift(defaultNodeBinPath);
}
if (!pathEntries.includes(defaultCargoBinPath)) {
  pathEntries.unshift(defaultCargoBinPath);
}
env[pathKey] = pathEntries.join(delimiter);

// Patch tauri.conf.json: disable createUpdaterArtifacts when no signing key
const confPath = join(process.cwd(), "src-tauri", "tauri.conf.json");
const conf = JSON.parse(readFileSync(confPath, "utf8"));
const originalUpdaterArtifacts = conf.bundle?.createUpdaterArtifacts;
if (!hasSigningKey && conf.bundle?.createUpdaterArtifacts) {
  conf.bundle.createUpdaterArtifacts = false;
  writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");
  console.log("Patched tauri.conf.json: createUpdaterArtifacts = false (no signing key)");
}

const syncIcons = spawn(process.execPath, [syncIconsPath], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

syncIcons.on("exit", (syncCode) => {
  if (syncCode !== 0) {
    // Restore original conf
    if (!hasSigningKey && originalUpdaterArtifacts) {
      conf.bundle.createUpdaterArtifacts = originalUpdaterArtifacts;
      writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");
    }
    process.exit(syncCode ?? 1);
  }

  const child = spawn(process.execPath, [tauriCliPath, "build", ...tauriArgs], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    // Restore original conf
    if (!hasSigningKey && originalUpdaterArtifacts) {
      conf.bundle.createUpdaterArtifacts = originalUpdaterArtifacts;
      writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");
    }
    process.exit(code ?? 1);
  });
});