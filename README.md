# Reword

Rewrite selected text in **any app** with a keystroke — professional, polite,
concise, or casual — without copy-pasting into ChatGPT each time. Powered by
your own free Google Gemini API key.

## → The app lives in [`desktop/`](desktop/)

A minimal Electron menu-bar / tray app for macOS + Windows. Select text
anywhere, press your shortcut, and it's rewritten in place.

```bash
cd desktop
npm install
npm start
```

Full setup and architecture are in [desktop/README.md](desktop/README.md).

## Building installers

Build on the **same OS** you're targeting — electron-builder does not reliably
cross-compile. Each command regenerates icons automatically.

### Windows → `.exe` installer

```bash
cd desktop
npm install
npm run dist:win
```
Output: `desktop/dist/Reword Setup <version>.exe` (installer) and
`desktop/dist/win-unpacked/Reword.exe` (portable).

> **One-time:** the installer step unpacks a signing toolkit containing symlinks,
> which Windows blocks unless **Developer Mode** is on
> (**Settings → System → For developers → Developer Mode**) or the terminal runs
> **as Administrator**. For just the portable app, use `npm run pack:win` (no
> installer, no signing, no symlink step).

### macOS → `.dmg`

```bash
cd desktop
npm install
npm run dist:mac
```
Output: `desktop/dist/Reword-<version>.dmg`. Drag Reword to Applications.

### Both are unsigned (personal use)
- **Windows:** SmartScreen → **More info → Run anyway**.
- **macOS:** right-click the app → **Open** the first time (Gatekeeper), and grant
  **Accessibility** permission on the first rewrite (needed for Copy/Paste).

## Repository layout

```
rewriter/
├─ desktop/       the Reword app (Electron) — the main project
├─ extension/     the original Chrome-extension prototype (browser-only)
└─ context.md    complete project reference
```

## `extension/`

The first prototype: right-click selected text → Rewrite, inside the browser
only. Kept for reference. See [extension/README.md](extension/README.md).

## Security

No API keys or secrets are committed. Each user enters their own Gemini key in
the app, and it's stored locally (the app's userData folder / the browser's
extension storage) — never in the repo. Build outputs (`dist/`) and dependencies
(`node_modules/`) are git-ignored.
