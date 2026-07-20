# Sidekick

Rewrite selected text in **any app** with a keystroke — professional, polite,
concise, or casual — and ask an AI quick questions without leaving what you're
doing. A tray app for Windows and macOS, powered by your own free Google Gemini
API key. No account, no server: everything runs locally.

- **Rewrite** — select text anywhere, press `Ctrl/Cmd+Shift+R`, and it's rewritten in place.
- **Quick Chat** — press `Ctrl/Cmd+Shift+C` for a floating chat popup. Nothing is ever saved to disk.

## Download

Grab the latest installer from the
[**Releases**](https://github.com/sandeeep-modi/sidekick/releases/latest) page.

### macOS (Apple Silicon)

1. Download the **`.dmg`**, open it, and drag **Sidekick** into **Applications**.
2. The app is unsigned, so the first launch is blocked. Clear it once in **Terminal**:
   ```bash
   xattr -dr com.apple.quarantine /Applications/Sidekick.app
   ```
   Then open Sidekick normally.
3. On the first rewrite, grant **Accessibility** permission when macOS asks
   (**System Settings → Privacy & Security → Accessibility**) — it's needed to
   simulate Copy/Paste.

### Windows

1. Download the **`.exe`** installer and run it.
2. It's unsigned, so SmartScreen may warn: click **More info → Run anyway**.

Paste a [free Gemini API key](https://aistudio.google.com/apikey), hit **Save**,
then **Test key**, and you're set.

## Run it

Requires Node.js 18+.

```bash
npm install
npm start
```

The settings window opens and Sidekick appears in your tray. Paste a
[free Gemini API key](https://aistudio.google.com/apikey), hit **Save**, then
**Test key**.

## Build an installer

Build on the **same OS** you're targeting — electron-builder does not reliably
cross-compile. Icons are regenerated automatically as part of each build.

```bash
npm run dist:win   # -> dist/Sidekick Setup <version>.exe
npm run dist:mac   # -> dist/Sidekick-<version>.dmg
```

> **Windows, one-time:** the installer step unpacks a signing toolkit containing
> symlinks, which Windows blocks unless **Developer Mode** is on
> (**Settings → System → For developers**) or the terminal runs **as Administrator**.
> For just the portable app, use `npm run pack:win`.

Both builds are unsigned. Windows SmartScreen: **More info → Run anyway**. macOS:
right-click → **Open** the first time, and grant **Accessibility** permission on
the first rewrite (it's needed to simulate Copy/Paste).

## Layout

```
src/
├─ main/        Electron main process — windows, tray, shortcuts, IPC, settings
├─ gemini/      Gemini API client, models, tones (no Electron, no UI)
├─ preload/     one contextBridge per window, each exposing only what it needs
└─ renderer/    the windows themselves (html + css + es modules)
icons/          the icon PNGs — loaded at runtime, and the source for the installers
scripts/        pack-icons.js — packs icons/*.png into build/icon.ico + .icns
```

`npm run lint` and `npm run format` keep it tidy.

## Security

Your Gemini API key is entered in the app and stored locally in the app's
userData folder — never in the repo. It is sent only to Google's Gemini endpoint.

The renderer windows are contextIsolated with no Node access, and each gets its
own preload: the chat window renders model output as HTML, so it is deliberately
given no channel that can reach the API key.
