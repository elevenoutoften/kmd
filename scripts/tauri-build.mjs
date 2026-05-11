import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
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

if (!env.TAURI_SIGNING_PRIVATE_KEY) {
  console.error("Tauri updater signing key not found.");
  console.error(`Set TAURI_SIGNING_PRIVATE_KEY or place a key at ${defaultKeyPath}.`);
  process.exit(1);
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

const syncIcons = spawn(process.execPath, [syncIconsPath], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

syncIcons.on("exit", (syncCode) => {
  if (syncCode !== 0) {
    process.exit(syncCode ?? 1);
  }

const child = spawn(process.execPath, [tauriCliPath, "build", ...tauriArgs], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
});
