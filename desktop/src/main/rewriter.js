// The rewrite pipeline: grab the selection, rewrite it, paste it back, while
// driving the overlay spinner.

const { clipboard } = require("electron");
const store = require("./store");
const overlay = require("./overlay");
const { notify } = require("./notify");
const { showWindow } = require("./window");
const { rewriteText, TONES } = require("../shared/gemini");
const automation = require("../shared/automation");

let busy = false;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const toneLabel = (id) => (TONES.find((t) => t.id === id) || {}).title || "";

function shortError(e) {
  const m = String((e && e.message) || e);
  if (/429|quota|rate/i.test(m)) return "Rate limit — try again";
  if (/404|not available/i.test(m)) return "Model unavailable";
  if (/api key|invalid/i.test(m)) return "Check API key";
  if (/network/i.test(m)) return "No connection";
  return m.length > 28 ? m.slice(0, 27) + "…" : m;
}

async function doRewrite() {
  if (busy) return;
  busy = true;

  const s = store.all();
  if (!s.apiKey) {
    notify("Reword", "Add your API key first.");
    showWindow();
    busy = false;
    return;
  }

  overlay.positionAtCursor();
  await overlay.setState("loading", toneLabel(s.tone));
  overlay.show();

  try {
    await automation.copy();
    await wait(280);
    const text = clipboard.readText();
    if (!text || !text.trim()) {
      await overlay.setState("error", "Select text first");
      setTimeout(overlay.hide, 1500);
      return;
    }

    const out = await rewriteText(text, s.tone, s.apiKey, s.model);
    clipboard.writeText(out);
    await wait(120);
    await automation.paste();

    await overlay.setState("done", "Rewritten");
    setTimeout(overlay.hide, 700);
  } catch (e) {
    await overlay.setState("error", shortError(e));
    setTimeout(overlay.hide, 2200);
  } finally {
    busy = false;
  }
}

module.exports = { doRewrite };
