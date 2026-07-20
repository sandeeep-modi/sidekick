const { app } = require("electron");
const store = require("./store");
const chats = require("./chats");
const { notify } = require("./notifications");
const { createTray } = require("./tray");
const { installAppMenu } = require("./menu");
const { registerIpc, applyShortcuts } = require("./ipc");
const { unregisterAllShortcuts } = require("./shortcuts");
const { createSettingsWindow, showSettingsWindow } = require("./windows/settings-window");
const { createChatWindow, toggleChatWindow } = require("./windows/chat-window");
const { createOverlayWindow } = require("./windows/overlay-window");

app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event) => event.preventDefault());
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

app.isQuitting = false;

app.on("before-quit", () => {
  app.isQuitting = true;
});

function quit() {
  app.isQuitting = true;
  app.quit();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showSettingsWindow);

  app.whenReady().then(() => {
    const { recovered } = store.init(app.getPath("userData"));
    if (!recovered) {
      notify("Your settings file was unreadable and has been reset. A copy was kept.");
    }
    chats.init(app.getPath("userData"));
    const settings = store.all();

    createTray({
      onOpen: showSettingsWindow,
      onChat: toggleChatWindow,
      onQuit: quit,
    });

    installAppMenu({ onQuit: quit });

    createSettingsWindow();
    createOverlayWindow();
    createChatWindow();

    if (!app.isPackaged) {
      require("./dev-reload").watchRenderer();
    }

    registerIpc();

    const shortcuts = applyShortcuts(settings);
    if (Object.values(shortcuts).some((ok) => !ok)) {
      notify(
        "A shortcut couldn't be registered — another app may be using it. Change it in Settings."
      );
    }

    if (app.isPackaged && settings.autoLaunch) {
      app.setLoginItemSettings({ openAtLogin: true, args: ["--hidden"] });
      if (!app.getLoginItemSettings().openAtLogin) {
        notify(
          "Start at login couldn't be enabled. Move Sidekick to your Applications folder and try again from Settings."
        );
      }
    }

    const openedAtLogin =
      process.argv.includes("--hidden") || app.getLoginItemSettings().wasOpenedAtLogin;
    if (!openedAtLogin) showSettingsWindow();

    if (process.platform === "darwin" && !app.isPackaged) app.dock?.hide();
  });

  app.on("window-all-closed", () => {}); // intentionally empty: tray app stays alive
  app.on("will-quit", unregisterAllShortcuts);
}
