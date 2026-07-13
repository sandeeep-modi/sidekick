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

// Defense-in-depth: the app only ever shows its own local pages, so no renderer
// should navigate anywhere or open a window. Even though the markdown renderer
// can't currently emit a link, this makes sure a future foothold can't turn into
// a navigation to a remote origin.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event) => event.preventDefault());
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

// Read by the window `close` handlers: they hide instead of closing, except when
// the app is genuinely on its way out.
app.isQuitting = false;

function quit() {
  app.isQuitting = true;
  app.quit();
}

// Second launch just focuses the running instance rather than starting a rival tray.
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

    // Surface a shortcut the OS refused (another app owns it) at boot, so the
    // feature isn't just silently dead.
    const shortcuts = applyShortcuts(settings);
    if (Object.values(shortcuts).some((ok) => !ok)) {
      notify(
        "A shortcut couldn't be registered — another app may be using it. Change it in Settings."
      );
    }

    // The OS login item points at a specific executable, so re-assert it on boot:
    // if the app is moved or reinstalled, the stored preference stays true.
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
