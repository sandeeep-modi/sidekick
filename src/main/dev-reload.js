const fs = require("fs");
const path = require("path");
const { BrowserWindow } = require("electron");

function watchRenderer() {
  const dir = path.join(__dirname, "..", "renderer");

  let pending = null;
  const reloadAll = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.reloadIgnoringCache();
      }
      console.warn("[dev-reload] renderer changed — reloaded all windows");
    }, 80);
  };

  try {
    fs.watch(dir, { recursive: true }, reloadAll);
    console.warn("[dev-reload] watching", dir);
  } catch (err) {
    console.warn("[dev-reload] could not watch renderer dir:", err.message);
  }
}

module.exports = { watchRenderer };
