# Reword — Project Context

Complete reference for this project. Read this to understand what Reword is, how
it's built, and how to run/build/change it — no further discussion needed.

---

## What it is

**Reword** rewrites selected text in a chosen tone (Professional, Polite,
Concise, Casual/Team) using Google Gemini. Two forms:

1. **Desktop app** (`desktop/`) — the main product. An Electron menu-bar/tray app
   for **Windows + macOS**. Select text in *any* app → press a global shortcut →
   the text is rewritten and pasted back in place. A small spinner shows progress.
2. **Chrome extension** (`extension/`) — the original browser-only prototype.
   Right-click selected text → Rewrite → preview → Replace/Copy. Kept for reference.

The user brings their own free Gemini API key. No account/server; everything runs
locally.

---

## Repository layout

```
rewriter/
├─ README.md            overview + build instructions
├─ context.md           this file
├─ .gitignore           ignores node_modules/, dist/, secrets
├─ desktop/             the Reword app (Electron) — main project
└─ extension/           the Chrome-extension prototype
```

### desktop/
```
desktop/
├─ package.json         electron-builder config + npm scripts
├─ icon-src/            MASTER icon PNGs (16..1024) — source of truth (committed)
├─ scripts/
│  └─ pack-icons.js     packs icon-src/*.png into ico/icns + runtime pngs
├─ build/              generated packaging icons (icon.ico/.icns/.png) — git-ignored
├─ assets/              runtime icons bundled in the app (icon-16/32/64/256.png)
└─ src/
   ├─ main/             Electron main process
   │  ├─ index.js       entry — wires modules, app lifecycle
   │  ├─ window.js      settings window (hides to tray on close)
   │  ├─ tray.js        tray icon + menu
   │  ├─ overlay.js     floating "Rewriting…" spinner (never takes focus)
   │  ├─ shortcut.js    global shortcut registration
   │  ├─ rewriter.js    pipeline: copy → rewrite → paste
   │  ├─ ipc.js         IPC handlers for the settings window
   │  ├─ store.js       settings persistence (userData/settings.json)
   │  └─ notify.js      desktop notifications
   ├─ preload/index.js  contextBridge API (window ↔ main)
   ├─ renderer/
   │  ├─ settings/      settings window (index.html + index.js)
   │  └─ overlay/       spinner window (index.html)
   └─ shared/           UI-agnostic
      ├─ gemini.js      rewrite engine (Gemini API)
      ├─ automation.js  OS-level Copy/Paste
      └─ icons.js       tray/window nativeImages
```

### extension/
`manifest.json` (MV3), `background.js` (service worker + Gemini call),
`content.js` (selection + popup + replace), `options.html`/`options.js`
(settings), `lib/gemini.js` (engine, kept in sync with the app), `icons/`.

---

## How the desktop rewrite works

Shortcut → `rewriter.doRewrite()`:
1. `automation.copy()` simulates Ctrl/Cmd+C to grab the selection.
2. Read the clipboard.
3. `gemini.rewriteText()` sends it to Gemini with the tone's prompt.
4. Write the result to the clipboard.
5. `automation.paste()` simulates Ctrl/Cmd+V.

The overlay spinner shows loading → ✓ / error. It's `focusable:false` +
`showInactive()` so it never steals focus (otherwise paste would land in it).

**Copy/paste uses built-in OS tools — no native npm modules:**
- Windows: PowerShell `SendKeys`.
- macOS: `osascript` (needs **Accessibility** permission, prompted on first use).
- Linux: `xdotool` (install separately).

---

## Gemini models & tones

- **Default model:** `gemini-3.1-flash-lite` (fastest, cheapest for short rewrites).
- **Also offered:** `gemini-3.5-flash` (higher quality), `gemini-flash-lite-latest`.
- **Important:** a brand-new free-tier key is only provisioned for the **3.x**
  family. `gemini-2.0-flash` → 429 `limit: 0`; `gemini-2.5-flash` → 404 "not
  available to new users". If a model shows `limit: 0`/404, pick another.
- **List a key's real models** (authoritative — don't guess model IDs):
  ```powershell
  (Invoke-RestMethod "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY").models |
    Where-Object { $_.supportedGenerationMethods -contains "generateContent" } |
    ForEach-Object { $_.name }
  ```
- **Tones:** Professional, Polite, Concise, Casual/Team (prompts in
  `shared/gemini.js` / extension `lib/gemini.js`).

Get a free key at https://aistudio.google.com/apikey (EU/personal accounts get a
key in a new project; free tier needs no billing).

---

## Branding

- **Name:** Reword.
- **Icon:** green squircle with a white "text → arrow → text + sparkle" mark.
  Brand green **`#72f69b`**; UI action/accent green **`#14a05a`**.
- Icon master art: `desktop/icon-src/icon-<size>.png` (committed). Regenerate all
  derived icons (app ico/icns/png, runtime assets, extension icons) with
  `npm run icons` in `desktop/`. The `desktop/build/` folder is generated and
  git-ignored.

---

## Settings & security

- Settings stored at `<userData>/settings.json` (Windows:
  `%APPDATA%/Reword/`, macOS: `~/Library/Application Support/Reword/`): apiKey,
  model, tone, shortcut, autoLaunch.
- The **API key is never hardcoded or committed** — entered in the UI, stored
  locally, sent only to Google's Gemini endpoint.
- `node_modules/` and `dist/` are git-ignored. No secrets in the repo.

---

## Run (development)

Requires Node.js 18+.
```bash
cd desktop
npm install
npm start
```
Settings window opens; app lives in the tray. Enter key → Save → Test key →
select text anywhere → press shortcut (default `Ctrl/Cmd+Shift+R`).

> **Dev-machine gotcha (this sandbox only):** if `ELECTRON_RUN_AS_NODE=1` is set,
> `electron .` runs as plain Node and `require("electron")` returns a path string
> (app is undefined). Launch with `env -u ELECTRON_RUN_AS_NODE npm start`. A
> normal terminal is unaffected.

---

## Build installers

Build on the **same OS** you're targeting (no reliable cross-compile). Each build
regenerates icons first (`npm run icons` is chained).

### Windows → `.exe`
```bash
cd desktop
npm install
npm run dist:win
```
Output: `dist/Reword Setup <version>.exe` + `dist/win-unpacked/` (portable).

> Needs **Developer Mode ON** (Settings → System → For developers) or an
> **Administrator** terminal — electron-builder unpacks a signing toolkit with
> symlinks that Windows otherwise blocks. Portable-only build that skips this:
> `npm run pack:win`.

### macOS → `.dmg`
```bash
cd desktop
npm install
npm run dist:mac
```
Output: `dist/Reword-<version>.dmg`.

### Unsigned (personal use)
- Windows: SmartScreen → **More info → Run anyway**.
- macOS: right-click app → **Open** first time; grant **Accessibility** on first rewrite.

### npm scripts
| Script | Does |
|---|---|
| `npm start` | Run in dev |
| `npm run icons` | Repack icons from `build/icon-source/` |
| `npm run pack` / `pack:win` | Unpacked app only (no installer/signing) |
| `npm run dist` / `dist:win` / `dist:mac` | Installer for the OS |

---

## Chrome extension

Load unpacked: `chrome://extensions` → Developer mode → **Load unpacked** →
select `extension/`. Set the key via the toolbar icon → Options. Same models,
tones, and green branding as the app. Works on web pages only (not `chrome://`).

---

## Known follow-ups / not done

- App is **unsigned** — needs paid code-signing certs for public distribution.
- No `LICENSE` file yet (package.json says MIT).
- No auto-update mechanism; version bumps are manual.
- No automated tests (manually verified).
- Rewrite overwrites the clipboard (original clipboard not restored afterward).
- macOS `.dmg` build to be produced on a Mac (not yet run).
