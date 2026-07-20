const { Tray, Menu } = require("electron");
const { trayIcon } = require("./icons");

let tray = null;

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
