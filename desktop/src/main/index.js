// Entry point: wires the modules together and manages the app lifecycle.

const { app } = require("electron");
const store = require("./store");
const { createWindow, showWindow, getWindow } = require("./window");
const { createTray } = require("./tray");
const { registerShortcut, unregisterShortcuts } = require("./shortcut");
const { ensureOverlay } = require("./overlay");
const { doRewrite } = require("./rewriter");
const { registerIpc } = require("./ipc");

app.isQuitting = false;

function quit() {
  app.isQuitting = true;
  app.quit();
}

// Single instance — a second launch just focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app.whenReady().then(() => {
    store.init(app.getPath("userData"));
    const settings = store.all();

    createTray({ onOpen: showWindow, onRewrite: doRewrite, onQuit: quit });
    createWindow();
    ensureOverlay(); // pre-load so the first rewrite shows it instantly
    registerIpc();
    registerShortcut(settings.shortcut, doRewrite);

    const openedAtLogin =
      process.argv.includes("--hidden") || app.getLoginItemSettings().wasOpenedAtLogin;
    if (openedAtLogin) getWindow().hide();

    if (process.platform === "darwin" && app.dock) app.dock.hide(); // tray-only
  });

  // Keep running in the tray when the window is closed.
  app.on("window-all-closed", () => {});
  app.on("will-quit", unregisterShortcuts);
}
