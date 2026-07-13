# Sidekick — Project Context

Complete reference for this project. Read this to understand what Sidekick is, how
it's built, and how to run, build and change it.

---

## What it is

**Sidekick** is an Electron tray app for **Windows + macOS** with two features, both
powered by Google Gemini:

1. **Rewrite** — select text in _any_ app, press a global shortcut (`Ctrl/Cmd+Shift+R`),
   and the text is rewritten in place in a chosen tone (Professional, Polite, Concise,
   Casual/Team). A small spinner shows progress.
2. **Quick Chat** — a floating popup for quick questions (`Ctrl/Cmd+Shift+C`). Nothing
   is written to disk and every open starts a fresh session.

The user brings their own free Gemini API key. No account, no server; everything runs
locally.

---

## Repository layout

```
sidekick/
├─ package.json         electron-builder config + npm scripts
├─ eslint.config.js     flat config: CommonJS for main, ES modules for renderers
├─ .prettierrc.json     printWidth 100, double quotes
├─ README.md            quick start + build instructions
├─ context.md           this file
├─ icons/               the icon PNGs (16..1024) — the single source of truth.
│                       The app loads the small ones at runtime; the installers use
│                       the packed formats derived from them.
├─ scripts/
│  └─ pack-icons.js     packs icons/*.png into build/icon.ico + .icns + .png
├─ build/               generated packaging icons — git-ignored
└─ src/
   ├─ main/                        Electron main process (CommonJS)
   │  ├─ index.js                  entry — app lifecycle + wiring, nothing else
   │  ├─ ipc.js                    every ipcMain handler, grouped by window
   │  ├─ store.js                  settings persistence (userData/settings.json)
   │  ├─ shortcuts.js              all global shortcuts, registered by id
   │  ├─ rewriter.js               pipeline: copy → rewrite → paste
   │  ├─ tray.js                   tray icon + menu
   │  ├─ clipboard.js              OS-level Copy/Paste
   │  ├─ icons.js                  tray/window nativeImages
   │  ├─ notifications.js          desktop notifications
   │  └─ windows/
   │     ├─ settings-window.js     settings window (hides to tray on close)
   │     ├─ chat-window.js         Quick Chat popup (position/size memory)
   │     └─ overlay-window.js      floating "Rewriting…" spinner
   ├─ gemini/                      Gemini API — no Electron, no UI
   │  ├─ client.js                 the one POST + error mapping
   │  ├─ models.js                 MODELS, DEFAULT_MODEL
   │  ├─ tones.js                  TONES + their prompts
   │  ├─ rewrite.js                rewriteText()
   │  └─ chat.js                   chatMessage()
   ├─ preload/                     one contextBridge per window (least privilege)
   │  ├─ settings.js               the only bridge that can touch the API key
   │  ├─ chat.js                   send/hide/reset — no settings access at all
   │  └─ overlay.js                listens for state; can't talk back
   └─ renderer/                    the windows (ES modules)
      ├─ shared/theme.css          design tokens + reset
      ├─ settings/                 index.html + settings.js/.css + accelerator.js
      ├─ chat/                     index.html + chat.js/.css, markdown.js/.css
      └─ overlay/                  index.html + overlay.js/.css
```

Renderers are plain **ES modules** loaded over `file://` (`<script type="module">`) —
no bundler, no build step. Main process and preloads are **CommonJS**.

---

## How the rewrite works

Shortcut → `rewriter.doRewrite()`:

1. `clipboard.copySelection()` simulates Ctrl/Cmd+C to grab the selection.
2. Read the clipboard.
3. `gemini/rewrite.rewriteText()` sends it to Gemini with the tone's prompt.
4. Write the result to the clipboard.
5. `clipboard.pasteClipboard()` simulates Ctrl/Cmd+V.

The overlay spinner shows loading → ✓ / error. It is `focusable: false` + `showInactive()`
so it never steals focus — otherwise the paste would land in the spinner.

Clipboard safety (`main/rewriter.js`): the copy is _verified_ — a sentinel is written to
the clipboard first, and if Ctrl+C doesn't replace it within ~1.5s, nothing was selected
and the rewrite aborts. This is what stops a failed copy from silently rewriting and
pasting whatever unrelated text (a password, a URL) was already on the clipboard. The
original clipboard is snapshotted and restored afterward. And if the API call took longer
than a few seconds — long enough that the user has likely switched windows — the result is
left on the clipboard with a "press Ctrl+V" hint instead of being auto-pasted somewhere
unexpected.

**Copy/paste uses built-in OS tools — no native npm modules:**

- Windows: PowerShell `SendKeys`.
- macOS: `osascript` (needs **Accessibility** permission, prompted on first use).
- Linux: `xdotool` (install separately).

---

## How Quick Chat works

```
toggle shortcut → toggleChatWindow()          [main/windows/chat-window.js]
    ├─ visible? → hide()
    └─ hidden?  → send("chat:reset", { model, closeWarning })   ← current settings, so
                  → show() + focus()                              changes apply with no
                                                                  restart
renderer/chat/chat.js
    - bumps sessionId, clears history[] and the DOM, focuses the input

User types + Enter
    → window.api.send({ history, userText })       [via src/preload/chat.js]
    → main/ipc.js "chat:send" reads apiKey, model, chatContext from the store
    → gemini/chat.js builds the multi-turn `contents` and POSTs it
    → { reply } or { error } comes back            ← only the reply text; the API key
    → renderer appends the AI bubble                 never leaves the main process
```

Key behaviours:

- **Nothing is stored.** History lives in a renderer array and dies with the session.
- **Every open is a fresh session.** `chat:reset` clears history, the DOM, and bumps a
  `sessionId`. A reply that arrives after its session ended is **dropped** — otherwise a
  request still in flight when you hide and reopen would leak into the new conversation.
- **Ending a session** (the end-session shortcut, or the X button) confirms first, unless
  the user ticked "don't show this again". Settings can switch that confirmation back on.
  The toggle shortcut and `Escape` just hide, with no confirmation.
- **Standing context** from Settings is prepended to every session as a synthetic
  user→model exchange, because Flash Lite has no system role.
- **AI replies are rendered as markdown** (`renderer/chat/markdown.js`). This is the one
  place untrusted text meets the DOM, so: everything is HTML-escaped before any markdown
  pattern runs; fenced code blocks are pulled out first and reinserted only after parsing
  (so a `- item` line inside a code block stays code); and the fence's language, which
  lands in a `class` attribute, is restricted to a bare word.

---

## Gemini models & tones

- **Default model:** `gemini-3.1-flash-lite` (fastest, cheapest for short rewrites,
  and the only tier with a workable free quota — sub-second replies).
- **Also offered:** `gemini-flash-lite-latest`, `gemini-3.5-flash`.
- **Important:** a brand-new free-tier key is only provisioned for the **3.x** family.
  `gemini-2.0-flash` → 429 `limit: 0`; `gemini-2.5-flash` → 404 "not available to new
  users". If a model shows `limit: 0`/404, pick another.
- **`gemini-3.5-flash` is a trap on the free tier.** Its quota is ~5 requests
  (`limit: 5` on `generate_content_free_tier_requests`), after which every call 429s,
  and it 503s / takes 2 minutes under load. It is offered for quality, but it is not a
  daily driver. If rewrites suddenly "stop working", check the model first.
- **Transient failures are handled in `gemini/client.js`:** 5xx responses and timeouts
  are retried (3 attempts, backing off), every request has a 30s timeout so a slow model
  can't hang the app, and 429/404 fail fast rather than hammering a real limit.
- **List a key's real models** (authoritative — don't guess model IDs):
  ```powershell
  (Invoke-RestMethod "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY").models |
    Where-Object { $_.supportedGenerationMethods -contains "generateContent" } |
    ForEach-Object { $_.name }
  ```
- **Tones:** Professional, Polite, Concise, Casual/Team (prompts in `src/gemini/tones.js`).

Get a free key at https://aistudio.google.com/apikey (the free tier needs no billing).

---

## Branding

- **Name:** Sidekick.
- **Icon:** light rounded-square with a green gradient "S". UI action/accent green
  **`#14a05a`** (see `src/renderer/shared/theme.css`).
- **Icons live in exactly one place:** `icons/icon-<size>.png`, committed. `main/icons.js`
  loads the 32 px and 256 px files at runtime; `npm run icons` packs the same PNGs into
  `build/icon.ico` / `.icns` / `.png` for the installers. `build/` is git-ignored.

---

## Settings & security

- Settings live at `<userData>/settings.json` (Windows: `%APPDATA%/Sidekick/`, macOS:
  `~/Library/Application Support/Sidekick/`): apiKey, model, tone, shortcut, autoLaunch,
  plus the Quick Chat keys.
- The **API key is never hardcoded or committed** — entered in the UI, sent only to
  Google's Gemini endpoint in the `x-goog-api-key` header (not the URL query string,
  which is the part most likely to end up in a log).
- **The key is encrypted at rest** with the OS keystore (DPAPI / Keychain / libsecret)
  via `safeStorage`; on disk it's `apiKeyEnc` ciphertext, never plaintext. If no keystore
  is available (some Linux setups) it falls back to plaintext so the key is never lost.
  A key saved by an older build is migrated to encrypted-at-rest on first launch (see
  `main/secret.js`, `main/store.js`).
- **The key does not leave the main process except to the settings window.**
  `store.publicSettings()` strips it, so `settings:get` never carries it. The settings
  window fetches it over a dedicated `settings:getApiKey` channel that verifies the
  sender. The chat window — the one that renders model output as HTML — has no preload
  method that can reach it.
- Every renderer is contextIsolated, `sandbox: true`, `nodeIntegration: false`, with a
  strict CSP (no inline script or style, no network). Nothing is loaded from a CDN. A
  central `web-contents-created` guard denies all navigation and window-open, so a
  rendering bug can't turn into a remote navigation.
- Settings are written atomically (temp file + rename) so a crash mid-write can't
  truncate `settings.json` and lose the key; a file that fails to parse is preserved as
  `settings.json.corrupt` and the user is told, rather than silently reset.
- `node_modules/`, `dist/` and `build/` are git-ignored. No secrets in the repo, and
  none in git history.

---

## Run (development)

Requires Node.js 18+.

```bash
npm install
npm start        # settings window opens; app lives in the tray
npm run lint     # eslint
npm run format   # prettier --write
```

Enter key → Save → Test key → select text anywhere → press the shortcut.

> **Dev-machine gotcha (this sandbox only):** if `ELECTRON_RUN_AS_NODE=1` is set,
> `electron .` runs as plain Node and `require("electron")` returns a path string
> (app is undefined). Launch with `env -u ELECTRON_RUN_AS_NODE npm start`. A normal
> terminal is unaffected.

---

## Build installers

Build on the **same OS** you're targeting (no reliable cross-compile). Each build
regenerates the icons first (`npm run icons` is chained).

```bash
npm run dist:win   # -> dist/Sidekick Setup <version>.exe  + dist/win-unpacked/
npm run dist:mac   # -> dist/Sidekick-<version>.dmg
```

> **Windows needs Developer Mode ON** (Settings → System → For developers) or an
> **Administrator** terminal — electron-builder unpacks a signing toolkit with symlinks
> that Windows otherwise blocks. Portable-only build that skips this: `npm run pack:win`.

**Upgrading an installed copy:** just run the new installer. NSIS keys its uninstall entry
off the `appId` (`com.sidekick.app`), so a new build removes the old one and installs over
it. No manual uninstall, as long as the appId doesn't change. Bump `version` in
`package.json` for each release.

### Unsigned (personal use)

- Windows: SmartScreen → **More info → Run anyway**.
- macOS: right-click the app → **Open** the first time; grant **Accessibility** on the
  first rewrite.

### npm scripts

| Script                             | Does                                 |
| ---------------------------------- | ------------------------------------ |
| `npm start`                        | Run in dev                           |
| `npm run icons`                    | Repack installer icons from `icons/` |
| `npm run lint` / `lint:fix`        | ESLint                               |
| `npm run format` / `format:check`  | Prettier                             |
| `npm run pack` / `pack:win`        | Unpacked app only (no installer)     |
| `npm run dist` / `dist:win`/`:mac` | Installer for the OS                 |

---

## Known follow-ups / not done

- App is **unsigned** — needs paid code-signing certs for public distribution.
- No `LICENSE` file yet (package.json says MIT).
- No auto-update mechanism; version bumps are manual.
- No automated tests (verified by hand and by driving the app).
- Rewrite overwrites the clipboard (the original clipboard is not restored).
- macOS `.dmg` build to be produced on a Mac (not yet run).
