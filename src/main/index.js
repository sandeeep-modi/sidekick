// Entry point: app lifecycle and wiring. Everything else lives in its own module.

const { app } = require("electron");
const store = require("./store");
const { notify } = require("./notifications");
const { createTray } = require("./tray");
const { registerIpc, applyShortcuts } = require("./ipc");
const { unregisterAllShortcuts } = require("./shortcuts");
const { createSettingsWindow, showSettingsWindow } = require("./windows/settings-window");
const { createChatWindow, toggleChatWindow } = require("./windows/chat-window");
const { createOverlayWindow } = require("./windows/overlay-window");

// The app only shows local pages, so a foothold can't turn into a remote navigation.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event) => event.preventDefault());
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

// Window `close` handlers hide instead of closing unless this is set.
app.isQuitting = false;

function quit() {
  app.isQuitting = true;
  app.quit();
}

// A second launch focuses the running instance rather than starting a rival tray.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showSettingsWindow);

  app.whenReady().then(() => {
    const { recovered } = store.init(app.getPath("userData"));
    if (!recovered) {
      notify("Your settings file was unreadable and has been reset. A copy was kept.");
    }
    const settings = store.all();

    createTray({
      onOpen: showSettingsWindow,
      onChat: toggleChatWindow,
      onQuit: quit,
    });

    createSettingsWindow();
    createOverlayWindow(); // pre-load, so the first rewrite shows the spinner instantly
    createChatWindow(); // pre-load hidden, so the first chat shortcut opens instantly

    registerIpc();

    // Surface a shortcut the OS refused at boot, so the feature isn't silently dead.
    const shortcuts = applyShortcuts(settings);
    if (Object.values(shortcuts).some((ok) => !ok)) {
      notify(
        "A shortcut couldn't be registered — another app may be using it. Change it in Settings."
      );
    }

    // Re-assert the login item on boot so the preference survives a move/reinstall.
    // (Skipped in dev, where the executable is electron.exe.)
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: settings.autoLaunch, args: ["--hidden"] });
    }

    const openedAtLogin =
      process.argv.includes("--hidden") || app.getLoginItemSettings().wasOpenedAtLogin;
    if (!openedAtLogin) showSettingsWindow();

    if (process.platform === "darwin") app.dock?.hide(); // tray-only
  });

  // The app lives in the tray, so closing every window must not quit it.
  app.on("window-all-closed", () => {});
  app.on("will-quit", unregisterAllShortcuts);
}
