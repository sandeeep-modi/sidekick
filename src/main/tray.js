const { Tray, Menu } = require("electron");
const { trayIcon } = require("./icons");

let tray = null;

// Note there is no "Rewrite selection now" item: clicking the tray moves focus
// away from the user's app, so the rewrite would have no selection to copy.
// Rewrite is only ever driven by the global shortcut.
function createTray({ onOpen, onChat, onQuit }) {
  tray = new Tray(trayIcon());
  tray.setToolTip("Sidekick");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Sidekick", click: onOpen },
      { label: "Quick Chat", click: onChat },
      { type: "separator" },
      { label: "Quit Sidekick", click: onQuit },
    ])
  );
  tray.on("click", onOpen);

  return tray;
}

module.exports = { createTray };
