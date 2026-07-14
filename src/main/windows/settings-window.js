// The settings window. Closing it hides the app; it keeps running in the tray.

const path = require("path");
const { app, BrowserWindow } = require("electron");
const { appIcon } = require("../icons");

let win = null;

function createSettingsWindow() {
  if (win) return win;

  win = new BrowserWindow({
    width: 440,
    height: 620,
    useContentSize: true, // height is the page area, so the UI never clips
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false, // shown explicitly, so starting at login never flashes the window
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

  // Hide instead of close, but let it through when quitting or this would veto app.quit().
  win.on("close", (e) => {
    if (app.isQuitting) return;
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
