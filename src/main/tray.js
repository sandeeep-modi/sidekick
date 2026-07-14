const { Tray, Menu } = require("electron");
const { trayIcon } = require("./icons");

let tray = null;

// No "Rewrite now" item: clicking the tray steals focus, so there'd be no selection
// to copy. Rewrite is only ever driven by the global shortcut.
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
