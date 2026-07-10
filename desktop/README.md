# Reword

Select text in **any** app → press your shortcut → it's rewritten in place.
Runs quietly in the tray / menu bar. Powered by your own Google Gemini key.

Tones: **Professional · Polite · Concise · Casual/Team**

---

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (bundles `fetch`, used by the rewrite engine).

## Run in development

```bash
cd desktop
npm install
npm start
```

The settings window opens and Reword appears in your tray / menu bar.

## First-time setup

1. Paste your **Gemini API key** (free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)). Hidden by default — click **Show** to reveal.
2. Pick a **model** (default `gemini-3.1-flash-lite`).
3. Choose your **default tone**.
4. Set your **shortcut** (default `Ctrl/Cmd+Shift+R`) — click **Change**, press keys.
5. Optionally tick **Start Reword at login**.
6. **Save**, then **Test key**.

The key is stored only on your machine (`settings.json` in the app's userData
folder). It is never hardcoded or committed.

## Use it

1. Select text in any app.
2. Press your shortcut. A spinner appears; the text is rewritten and pasted back.

---

## Building installers

Build on the **same OS** you're targeting — electron-builder does not reliably
cross-compile (macOS `.dmg` packaging and its symlinked tooling need macOS).
Each build first regenerates icons (`npm run icons`) automatically.

### Windows → `.exe` installer

```bash
cd desktop
npm install
npm run dist:win
```

Output: `dist/Reword Setup <version>.exe` (NSIS installer) plus `dist/win-unpacked/`
(a portable, runnable copy).

> **One-time note:** the installer step unpacks a signing toolkit that contains
> symlinks, which Windows blocks unless **Developer Mode** is on. Enable it at
> **Settings → System → For developers → Developer Mode**, or run the terminal
> **as Administrator**. If you only need the portable app, `npm run pack:win`
> skips the installer and never hits this.

### macOS → `.dmg`

```bash
cd desktop
npm install
npm run dist:mac
```

Output: `dist/Reword-<version>.dmg`. Drag Reword to Applications.

### Both are unsigned (personal use)

- **Windows:** SmartScreen → **More info → Run anyway**.
- **macOS:** right-click the app → **Open** the first time (Gatekeeper).
- **macOS Accessibility:** the first rewrite prompts for Accessibility permission
  (System Settings → Privacy & Security → Accessibility) — required so Reword can
  send Copy/Paste.

### Other build commands

| Command | Result |
|---|---|
| `npm run icons` | Regenerate app icons from `scripts/generate-icons.js` |
| `npm run pack` / `pack:win` | Unpacked app only (no installer, no signing) |
| `npm run dist` | Installer for the current OS |

---

## Architecture

```
desktop/
├─ package.json            electron-builder config + scripts
├─ scripts/
│  └─ generate-icons.js    generates build/ + assets/ icons (pure Node)
├─ build/                  icons for packaging (icon.ico / .icns / .png)
├─ assets/                 runtime icons bundled into the app (icon-*.png)
└─ src/
   ├─ main/                Electron main process
   │  ├─ index.js          entry point — wires modules, app lifecycle
   │  ├─ window.js         settings window (hides to tray on close)
   │  ├─ tray.js           tray icon + menu
   │  ├─ overlay.js        floating "Rewriting…" spinner
   │  ├─ shortcut.js       global shortcut registration
   │  ├─ rewriter.js       pipeline: copy → rewrite → paste
   │  ├─ ipc.js            IPC handlers for the settings window
   │  ├─ store.js          settings persistence (userData/settings.json)
   │  └─ notify.js         desktop notifications
   ├─ preload/
   │  └─ index.js          contextBridge API (window ↔ main)
   ├─ renderer/
   │  ├─ settings/         the settings window (index.html + index.js)
   │  └─ overlay/          the spinner window (index.html)
   └─ shared/              reusable, UI-agnostic
      ├─ gemini.js         rewrite engine (Gemini API)
      ├─ automation.js     OS-level Copy/Paste
      └─ icons.js          tray/window nativeImages
```

**Flow:** shortcut → `rewriter.doRewrite()` → `automation.copy()` →
`gemini.rewriteText()` → clipboard → `automation.paste()`, with `overlay`
showing progress. The settings window talks to the main process only through
`preload` (contextIsolation on, nodeIntegration off).

## How text replacement works

No native modules. On the shortcut, Reword simulates **Copy** to grab the
selection, reads the clipboard, rewrites via Gemini, writes the result back, and
simulates **Paste**. That's why macOS needs Accessibility permission.
