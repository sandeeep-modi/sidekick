// The settings window. Closing it hides the app (it keeps running in the tray).

const path = require("path");
const { app, BrowserWindow } = require("electron");
const { appIcon } = require("../shared/icons");

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 440,
    height: 600,
    useContentSize: true, // height is the page area, so the UI never clips/scrolls
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Reword",
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "..", "renderer", "settings", "index.html"));

  win.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  return win;
}

function showWindow() {
  if (!win) createWindow();
  win.show();
  win.focus();
}

function getWindow() {
  return win;
}

module.exports = { createWindow, showWindow, getWindow };
