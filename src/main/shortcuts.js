const { globalShortcut } = require("electron");

const registered = new Map();

function registerShortcut(id, accelerator, handler) {
  const previous = registered.get(id);
  if (previous) {
    globalShortcut.unregister(previous);
    registered.delete(id);
  }

  if (!accelerator) return false;

  for (const [otherId, otherAccel] of registered) {
    if (otherId !== id && otherAccel === accelerator) return false;
  }

  try {
    if (!globalShortcut.register(accelerator, handler)) return false;
    registered.set(id, accelerator);
    return true;
  } catch {
    return false;
  }
}

function unregisterAllShortcuts() {
  globalShortcut.unregisterAll();
  registered.clear();
}

module.exports = { registerShortcut, unregisterAllShortcuts };
