const { app, ipcMain, shell } = require("electron");
const store = require("./store");
const chats = require("./chats");
const { registerShortcut, unregisterAllShortcuts } = require("./shortcuts");
const { doRewrite } = require("./rewriter");
const { rewriteText } = require("../gemini/rewrite");
const { chatMessage } = require("../gemini/chat");
const { resolveModels } = require("../gemini/models");
const { TONES } = require("../gemini/tones");
const { getSettingsWindow } = require("./windows/settings-window");
const {
  getChatWindow,
  hideChatWindow,
  toggleChatWindow,
  requestCloseChatWindow,
} = require("./windows/chat-window");

function assertSender(event, win, channel) {
  // Security: reject the invoke unless it came from the expected window.
  if (!win || event.sender !== win.webContents) {
    throw new Error(`Refused ${channel} from an unexpected window.`);
  }
}

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

let modelCache = { key: null, models: null };

async function modelsForKey(apiKey) {
  if (modelCache.models && modelCache.key === apiKey) return modelCache.models;
  const models = await resolveModels(apiKey);
  modelCache = { key: apiKey, models };
  return models;
}

function registerIpc() {
  ipcMain.handle("settings:get", async () => ({
    settings: store.publicSettings(),
    models: await modelsForKey(store.all().apiKey),
    tones: TONES,
  }));

  ipcMain.handle("settings:getApiKey", (event) => {
    assertSender(event, getSettingsWindow(), "settings:getApiKey");
    return store.all().apiKey;
  });

  ipcMain.handle("settings:set", (event, patch) => {
    assertSender(event, getSettingsWindow(), "settings:set");

    const saved = store.set(patch);
    const settings = store.all();

    if ("apiKey" in patch) modelCache = { key: null, models: null };

    let shortcuts = null;
    if ("shortcut" in patch || "chatShortcut" in patch || "chatCloseShortcut" in patch) {
      shortcuts = applyShortcuts(settings);
    }

    let autoLaunchApplied = null;
    if ("autoLaunch" in patch) {
      app.setLoginItemSettings({ openAtLogin: settings.autoLaunch, args: ["--hidden"] });
      autoLaunchApplied = app.getLoginItemSettings().openAtLogin === settings.autoLaunch;
    }

    return { settings: store.publicSettings(), saved, shortcuts, autoLaunchApplied };
  });

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

    const { apiKey, tone, rewriteModel } = store.all();
    try {
      await rewriteText("hello there, quick test", tone, apiKey, rewriteModel);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle("app:openExternal", (event, url) => {
    assertSender(event, getSettingsWindow(), "app:openExternal");
    // Security: allowlist only, so this can't become an arbitrary-URL opener.
    const ALLOWED = new Set(["https://aistudio.google.com/apikey"]);
    if (ALLOWED.has(url)) shell.openExternal(url);
  });

  ipcMain.handle("app:quit", (event) => {
    assertSender(event, getSettingsWindow(), "app:quit");
    app.isQuitting = true;
    app.quit();
  });

  ipcMain.handle("chat:init", (event) => {
    assertSender(event, getChatWindow(), "chat:init");
    const { chatModel, chatCloseWarning } = store.all();
    return { model: chatModel, closeWarning: chatCloseWarning };
  });

  ipcMain.handle("chat:send", async (event, { history, userText }) => {
    assertSender(event, getChatWindow(), "chat:send");

    const { apiKey, chatModel, chatContext } = store.all();
    if (!apiKey) return { error: "NO_KEY" };

    try {
      const reply = await chatMessage({
        history,
        userText,
        context: chatContext,
        apiKey,
        model: chatModel,
      });
      return { reply };
    } catch (error) {
      return { error: String(error?.message || error) };
    }
  });

  ipcMain.handle("chat:hide", () => hideChatWindow());

  ipcMain.handle("chat:setCloseWarning", (event, enabled) => {
    assertSender(event, getChatWindow(), "chat:setCloseWarning");
    store.set({ chatCloseWarning: Boolean(enabled) });
  });

  ipcMain.handle("chat:save", (event, history) => {
    assertSender(event, getChatWindow(), "chat:save");
    return chats.save(history);
  });

  ipcMain.handle("chat:list", (event) => {
    assertSender(event, getChatWindow(), "chat:list");
    return chats.list();
  });

  ipcMain.handle("chat:load", (event, id) => {
    assertSender(event, getChatWindow(), "chat:load");
    return chats.load(id);
  });

  ipcMain.handle("chat:delete", (event, id) => {
    assertSender(event, getChatWindow(), "chat:delete");
    return chats.remove(id);
  });
}

module.exports = { registerIpc, applyShortcuts };
