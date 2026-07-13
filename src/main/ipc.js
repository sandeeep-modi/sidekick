// Every ipcMain handler. Channels are grouped by the window they serve, and the
// sensitive ones verify the sender: a renderer can only call what its own preload
// exposes, but a compromised chat window must not be able to reach the API key by
// invoking a settings channel directly.

const { app, ipcMain } = require("electron");
const store = require("./store");
const { registerShortcut, unregisterAllShortcuts } = require("./shortcuts");
const { doRewrite } = require("./rewriter");
const { rewriteText } = require("../gemini/rewrite");
const { chatMessage } = require("../gemini/chat");
const { MODELS } = require("../gemini/models");
const { TONES } = require("../gemini/tones");
const { getSettingsWindow } = require("./windows/settings-window");
const {
  getChatWindow,
  hideChatWindow,
  toggleChatWindow,
  requestCloseChatWindow,
} = require("./windows/chat-window");

/** Throw unless the call really came from `win` — ipcMain rejects the invoke on throw. */
function assertSender(event, win, channel) {
  if (!win || event.sender !== win.webContents) {
    throw new Error(`Refused ${channel} from an unexpected window.`);
  }
}

/**
 * (Re)bind every global shortcut to the current settings.
 * @returns {{rewrite: boolean, chatShortcut: boolean, chatCloseShortcut: boolean}}
 *   which ones the OS accepted, so the settings UI can flag any it refused.
 */
function applyShortcuts(settings) {
  return {
    rewrite: registerShortcut("rewrite", settings.shortcut, doRewrite),
    chatShortcut: registerShortcut("chat-toggle", settings.chatShortcut, toggleChatWindow),
    chatCloseShortcut: registerShortcut(
      "chat-close",
      settings.chatCloseShortcut,
      requestCloseChatWindow
    ),
  };
}

function registerIpc() {
  // ---- Settings window ------------------------------------------------------

  ipcMain.handle("settings:get", () => ({
    settings: store.publicSettings(), // no apiKey in here — see store.publicSettings()
    models: MODELS,
    tones: TONES,
  }));

  // The only channel that hands out the key, and only to the settings window,
  // which needs it to populate its input.
  ipcMain.handle("settings:getApiKey", (event) => {
    assertSender(event, getSettingsWindow(), "settings:getApiKey");
    return store.all().apiKey;
  });

  ipcMain.handle("settings:set", (event, patch) => {
    assertSender(event, getSettingsWindow(), "settings:set");

    const saved = store.set(patch);
    const settings = store.all();

    let shortcuts = null;
    if ("shortcut" in patch || "chatShortcut" in patch || "chatCloseShortcut" in patch) {
      shortcuts = applyShortcuts(settings);
    }
    if ("autoLaunch" in patch) {
      app.setLoginItemSettings({ openAtLogin: settings.autoLaunch, args: ["--hidden"] });
    }

    return { settings: store.publicSettings(), saved, shortcuts };
  });

  // The shortcut recorder in Settings needs the global shortcuts out of the way,
  // or pressing e.g. the current chat combo would just open chat instead of being
  // recorded. Settings suspends them while recording and resumes on save/close.
  ipcMain.handle("shortcuts:suspend", (event) => {
    assertSender(event, getSettingsWindow(), "shortcuts:suspend");
    unregisterAllShortcuts();
  });

  ipcMain.handle("shortcuts:resume", (event) => {
    assertSender(event, getSettingsWindow(), "shortcuts:resume");
    return applyShortcuts(store.all());
  });

  ipcMain.handle("settings:testKey", async (event) => {
    assertSender(event, getSettingsWindow(), "settings:testKey");

    const { apiKey, tone, model } = store.all();
    try {
      await rewriteText("hello there, quick test", tone, apiKey, model);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle("app:quit", () => {
    app.isQuitting = true;
    app.quit();
  });

  // ---- Chat window ----------------------------------------------------------
  // Nothing here can read the API key: it is used in main, and only the reply
  // text ever crosses back to the renderer.

  ipcMain.handle("chat:init", () => {
    const { model, chatCloseWarning } = store.all();
    return { model, closeWarning: chatCloseWarning };
  });

  ipcMain.handle("chat:send", async (event, { history, userText }) => {
    // Never returns the key, but gate it anyway so only the chat window can spend
    // the user's quota with arbitrary prompts.
    assertSender(event, getChatWindow(), "chat:send");

    const { apiKey, model, chatContext } = store.all();
    if (!apiKey) return { error: "NO_KEY" };

    try {
      const reply = await chatMessage({ history, userText, context: chatContext, apiKey, model });
      return { reply };
    } catch (error) {
      return { error: String(error?.message || error) };
    }
  });

  ipcMain.handle("chat:hide", () => hideChatWindow());

  // Backs the chat's "don't show this again" box. Deliberately narrower than
  // settings:set — the chat window can flip this one flag and nothing else.
  ipcMain.handle("chat:setCloseWarning", (event, enabled) => {
    assertSender(event, getChatWindow(), "chat:setCloseWarning");
    store.set({ chatCloseWarning: Boolean(enabled) });
  });
}

module.exports = { registerIpc, applyShortcuts };
