const { globalShortcut } = require("electron");

function registerShortcut(accelerator, handler) {
  globalShortcut.unregisterAll();
  if (!accelerator) return false;
  try {
    return globalShortcut.register(accelerator, handler);
  } catch {
    return false;
  }
}

function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

module.exports = { registerShortcut, unregisterShortcuts };
