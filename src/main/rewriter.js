const { clipboard } = require("electron");
const store = require("./store");
const overlay = require("./windows/overlay-window");
const { showSettingsWindow } = require("./windows/settings-window");
const { notify } = require("./notifications");
const { copySelection, pasteClipboard } = require("./clipboard");
const { rewriteText } = require("../gemini/rewrite");
const { toneTitle } = require("../gemini/tones");

// Sentinel + poll proves Ctrl+C landed; if clipboard never changes, nothing was selected (don't rewrite stale text).
const COPY_POLL_MS = 40;
const COPY_TIMEOUT_MS = 1500;
const COPY_SENTINEL = "\u0000sidekick-copy-probe\u0000";

const PASTE_SETTLE_MS = 120;

// Past this the user likely switched windows; leave result on clipboard for manual paste instead of pasting into the wrong place.
const AUTO_PASTE_MAX_ELAPSED_MS = 4000;

const HIDE_AFTER_SUCCESS_MS = 900;
const HIDE_AFTER_ERROR_MS = 2200;

let busy = false;
let hideTimer = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The overlay pill is ~28 chars wide — turn any error into something that fits.
function shortError(error) {
  const message = String(error?.message || error);

  if (/timed out/i.test(message)) return "Timed out — try again";
  if (/429|quota|rate/i.test(message)) return "Rate limit — try again";
  if (/busy|50[024]/i.test(message)) return "Model busy — try again";
  if (/404|not available/i.test(message)) return "Model unavailable";
  if (/api key|invalid/i.test(message)) return "Check API key";
  if (/not found|command failed|enoent|127/i.test(message)) return "Install xdotool (Linux)";
  if (/network/i.test(message)) return "No connection";

  return message.length > 28 ? `${message.slice(0, 27)}…` : message;
}

function finish(state, text, hideAfterMs) {
  overlay.setOverlayState(state, text);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(overlay.hideOverlay, hideAfterMs);
}

// Returns copied text, or null on timeout.
async function grabSelection() {
  clipboard.writeText(COPY_SENTINEL);
  await copySelection();

  const deadline = Date.now() + COPY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const current = clipboard.readText();
    if (current !== COPY_SENTINEL) return current;
    await wait(COPY_POLL_MS);
  }
  return null;
}

async function doRewrite() {
  if (busy) return;
  busy = true;
  clearTimeout(hideTimer);

  const { apiKey, tone, rewriteModel } = store.all();
  if (!apiKey) {
    notify("Add your API key first.");
    showSettingsWindow();
    busy = false;
    return;
  }

  // Snapshot the clipboard so we can restore what the user had copied.
  const originalClipboard = clipboard.readText();
  let restoreClipboard = true;

  try {
    overlay.positionAtCursor();
    overlay.setOverlayState("loading", toneTitle(tone));
    overlay.showOverlay();

    const selection = await grabSelection();
    if (!selection || !selection.trim()) {
      finish("error", "Select text first", HIDE_AFTER_ERROR_MS);
      return;
    }

    const startedAt = Date.now();
    const { text: rewritten, switchedFrom } = await rewriteText(
      selection,
      tone,
      apiKey,
      rewriteModel
    );
    clipboard.writeText(rewritten);

    const doneLabel = switchedFrom ? "Rewritten (switched model)" : "Rewritten";

    if (Date.now() - startedAt <= AUTO_PASTE_MAX_ELAPSED_MS) {
      await wait(PASTE_SETTLE_MS);
      await pasteClipboard();
      await wait(PASTE_SETTLE_MS);
      finish("done", doneLabel, HIDE_AFTER_SUCCESS_MS);
    } else {
      // Deliberately leave the rewritten text on the clipboard for a manual paste.
      restoreClipboard = false;
      finish("done", `${doneLabel} — press Ctrl+V`, HIDE_AFTER_ERROR_MS);
    }
  } catch (error) {
    finish("error", shortError(error), HIDE_AFTER_ERROR_MS);
  } finally {
    if (restoreClipboard) clipboard.writeText(originalClipboard);
    busy = false;
  }
}

module.exports = { doRewrite };
