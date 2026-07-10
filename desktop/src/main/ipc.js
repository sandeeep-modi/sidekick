// IPC handlers used by the settings window.

const { app, ipcMain } = require("electron");
const store = require("./store");
const { registerShortcut } = require("./shortcut");
const { doRewrite } = require("./rewriter");
const { notify } = require("./notify");
const { rewriteText, MODELS, TONES } = require("../shared/gemini");

function registerIpc() {
  ipcMain.handle("settings:get", () => ({
    settings: store.all(),
    models: MODELS,
    tones: TONES,
  }));

  ipcMain.handle("settings:set", (_e, patch) => {
    const s = store.set(patch);
    if ("shortcut" in patch) {
      const ok = registerShortcut(s.shortcut, doRewrite);
      if (!ok) notify("Reword", "That shortcut couldn't be registered — try another.");
    }
    if ("autoLaunch" in patch) {
      app.setLoginItemSettings({ openAtLogin: !!s.autoLaunch, args: ["--hidden"] });
    }
    return s;
  });

  ipcMain.handle("key:test", async () => {
    const s = store.all();
    try {
      await rewriteText("hello there, quick test", s.tone || "concise", s.apiKey, s.model);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  });

  ipcMain.handle("app:quit", () => {
    app.isQuitting = true;
    app.quit();
  });
}

module.exports = { registerIpc };
