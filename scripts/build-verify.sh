#!/usr/bin/env bash
# scripts/build-verify.sh — Verify desktop build artifacts
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== kmd build verification ==="

echo "1. Frontend build..."
npm run build
echo "   dist/ size: $(du -sh dist/ | cut -f1)"

echo "2. Rust check..."
cargo check --manifest-path src-tauri/Cargo.toml

echo "3. Tauri debug build..."
cargo tauri build --debug --manifest-path src-tauri/Cargo.toml

echo "4. Bundle contents:"
ls -lh src-tauri/target/debug/bundle/ 2>/dev/null || echo "   (no bundles — platform-specific)"

echo "=== All checks passed ==="
