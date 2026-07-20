const path = require("path");
const { app, BrowserWindow } = require("electron");
const { appIcon } = require("../icons");

let win = null;

function createSettingsWindow() {
  if (win) return win;

  win = new BrowserWindow({
    width: 440,
    height: 620,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: "Sidekick",
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, "..", "..", "preload", "settings.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "..", "..", "renderer", "settings", "index.html"));

  win.on("close", (e) => {
    if (app.isQuitting) return; // let close through when quitting, else this vetoes app.quit()
    e.preventDefault();
    win.hide();
  });

  return win;
}

function showSettingsWindow() {
  const w = createSettingsWindow();
  w.show();
  w.focus();
}

const getSettingsWindow = () => win;

module.exports = { createSettingsWindow, showSettingsWindow, getSettingsWindow };
