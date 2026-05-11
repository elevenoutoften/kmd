# Releasing kmd

This repo is set up to publish portable-first desktop downloads from GitHub Actions instead of requiring a local hand-built release every time.

## One-time setup

1. Generate a Tauri updater signing key if the project does not already have one.
2. Add a GitHub Actions repository secret named `TAURI_SIGNING_PRIVATE_KEY`.
3. Set the secret value to the private key contents.
4. Keep the corresponding public key in `src-tauri/tauri.conf.json`.
5. Enroll in the paid Apple Developer Program for public macOS distribution.
6. Create a `Developer ID Application` certificate, export it from Keychain Access as a `.p12`, and base64-encode it:

```bash
openssl base64 -A -in DeveloperIDApplication.p12 -out DeveloperIDApplication-base64.txt
```

7. Add these GitHub Actions repository secrets for signed and notarized macOS releases:

- `APPLE_CERTIFICATE`: contents of `DeveloperIDApplication-base64.txt`
- `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`
- `APPLE_ID`: Apple ID email used for notarization
- `APPLE_PASSWORD`: app-specific password for that Apple ID
- `APPLE_TEAM_ID`: Apple Developer Team ID

Never commit updater private keys, Apple signing credentials, Windows certificates, or local machine paths.

## Release flow

1. Update the app version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Commit the version bump.
3. Create and push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

4. GitHub Actions builds and publishes the release artifacts.

## Expected release assets

- macOS Apple Silicon signed and notarized `.dmg`
- macOS Apple Silicon signed and notarized portable `.app.zip`
- macOS Intel signed and notarized `.dmg`
- macOS Intel signed and notarized portable `.app.zip`
- Windows portable `.exe`
- Windows `.msi`
- Windows `.exe` installer
- Tauri updater metadata such as `latest.json` and signatures

## Portable builds

- `npm run tauri:portable` creates a standalone Windows binary at `src-tauri/target/release/kmd.exe`.
- `npm run tauri:bundle:app` creates a macOS `.app` bundle when run on a Mac.
- GitHub Actions renames the Windows portable binary to `kmd_<version>_windows-x64-portable.exe`.
- GitHub Actions zips macOS `.app` bundles as `kmd_<version>_macos-x64-portable.app.zip` and `kmd_<version>_macos-arm64-portable.app.zip`.
- macOS release jobs validate the Developer ID signature, submit the portable `.app` bundle for notarization, staple the notarization ticket, and run Gatekeeper assessment before upload.
- Keep installer-based release assets for users who prefer installation and for auto-updates. Tauri's updater uses installer artifacts on Windows and app bundles on macOS.

## Notes

- The updater is configured to read `https://github.com/elevenoutoften/kmd/releases/latest/download/latest.json`.
- Windows updater artifacts prefer the NSIS `.exe` installer when both `.msi` and `.exe` are available.
- The Apple Silicon job runs first on GitHub's ARM64 macOS runner.
- Public macOS releases must be signed with a `Developer ID Application` certificate and notarized. Ad-hoc signing is not enough for downloads that should open normally on other people's laptops.
