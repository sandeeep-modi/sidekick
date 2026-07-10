# Reword (Chrome extension)

The original browser-only prototype of [Reword](../README.md). Select text on any
web page → right-click → **Rewrite** → pick a tone → get a preview → **Replace**
it in place or **Copy** it. Powered by your own Google Gemini API key.

> The main project is the desktop app in [`../desktop/`](../desktop/), which works
> system-wide (any app, not just the browser). This extension is kept for
> reference and browser use.

Tones: **Professional · Polite · Concise · Casual / Team**

---

## Get a free Gemini API key

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with your Google account.
3. Click **Create API key** and copy it (starts with `AIza…`).

The Gemini API has a **free tier** — no billing required. The extension defaults
to `gemini-3.1-flash-lite` (switchable in Options).

## Install (developer mode)

1. Open **chrome://extensions** (or Edge: `edge://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. The green **Reword** icon appears in your toolbar.

## Add your key

1. Click the **Reword** toolbar icon (or right-click it → Options).
2. Paste your Gemini key. It's **hidden by default** — click **Show** to reveal.
3. Click **Save**, then **Test key**.

The key is stored in `chrome.storage.sync` (your browser only) and is never
hardcoded or sent anywhere except Google's Gemini API.

## Use it

1. Select some text (Gmail, a textarea, LinkedIn, etc.).
2. Right-click → **Rewrite** → choose a tone.
3. The popup shows the rewrite: **Replace** (editable fields), **Copy** (anywhere),
   or **Regenerate**. `Esc` or click outside to dismiss.

---

## Project layout

| File | Role |
|---|---|
| `manifest.json` | MV3 config, permissions, context menus, icons |
| `background.js` | Service worker: builds menus, makes the Gemini call |
| `content.js` | Reads the selection, shows the popup, replaces text |
| `lib/gemini.js` | Rewrite engine (kept in sync with the desktop app) |
| `options.html` / `options.js` | Settings page: enter/save/test the API key |
| `icons/` | Toolbar/extension icons (generated with the desktop app's `npm run icons`) |

## Notes & limits

- Works on normal web pages, **not** on `chrome://` pages or the Chrome Web Store.
- **Replace** only works in editable fields; on read-only text, use **Copy**.
- All API calls go through `lib/gemini.js` — swap in a backend proxy there if you
  ever publish this publicly (so the key isn't shipped to users).

See [`../context.md`](../context.md) for the full project reference.
