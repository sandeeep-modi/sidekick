// Every global shortcut, re-registered individually so changing one can't drop the others.

const { globalShortcut } = require("electron");

// id -> currently registered accelerator
const registered = new Map();

/**
 * Register (or re-register) one shortcut.
 * @param {string} id           Stable key, e.g. "rewrite".
 * @param {string} accelerator  Electron accelerator, e.g. "CommandOrControl+Shift+R".
 * @param {() => void} handler
 * @returns {boolean} Whether it is now registered (false if the OS refused it).
 */
function registerShortcut(id, accelerator, handler) {
  const previous = registered.get(id);
  if (previous) {
    globalShortcut.unregister(previous);
    registered.delete(id);
  }

  if (!accelerator) return false;

  // Refuse an accelerator another action already holds, or re-registering later breaks both.
  for (const [otherId, otherAccel] of registered) {
    if (otherId !== id && otherAccel === accelerator) return false;
  }

  try {
    if (!globalShortcut.register(accelerator, handler)) return false;
    registered.set(id, accelerator);
    return true;
  } catch {
    return false; // malformed accelerator
  }
}

function unregisterAllShortcuts() {
  globalShortcut.unregisterAll();
  registered.clear();
}

module.exports = { registerShortcut, unregisterAllShortcuts };
