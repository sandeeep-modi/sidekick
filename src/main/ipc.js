// Every ipcMain handler, grouped by window. Sensitive channels verify the sender so
// a compromised chat window can't invoke a settings channel and reach the API key.

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

  // Muted while the recorder listens, so pressing a combo records it instead of firing it.
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

  ipcMain.handle("app:quit", (event) => {
    assertSender(event, getSettingsWindow(), "app:quit");
    app.isQuitting = true;
    app.quit();
  });

  // ---- Chat window ----------------------------------------------------------
  // Nothing here can read the API key — only reply text crosses back to the renderer.

  ipcMain.handle("chat:init", (event) => {
    assertSender(event, getChatWindow(), "chat:init");
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
