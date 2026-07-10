const { Tray, Menu } = require("electron");
const { trayIcon } = require("../shared/icons");

let tray = null;

function createTray({ onOpen, onRewrite, onQuit }) {
  tray = new Tray(trayIcon());
  tray.setToolTip("Reword");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Reword", click: onOpen },
      { label: "Rewrite selection now", click: onRewrite },
      { type: "separator" },
      { label: "Quit Reword", click: onQuit },
    ])
  );
  tray.on("click", onOpen);
  return tray;
}

module.exports = { createTray };
