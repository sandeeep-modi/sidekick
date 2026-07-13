// Turning keyboard events into Electron accelerators, and back into something
// a human can read.

const IS_MAC = navigator.platform.toLowerCase().includes("mac");

const NAMED_KEYS = {
  " ": "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Enter: "Return",
  ".": "Period",
  ",": "Comma",
  "/": "Slash",
  ";": "Semicolon",
};

const MODIFIER_KEYS = ["Shift", "Control", "Alt", "Meta"];

/** "CommandOrControl+Shift+R" -> "Ctrl + Shift + R" (or "Cmd + …" on macOS). */
export function formatAccelerator(accelerator) {
  return accelerator
    .replace("CommandOrControl", IS_MAC ? "Cmd" : "Ctrl")
    .replace("Alt", IS_MAC ? "Option" : "Alt")
    .replace(/\+/g, " + ");
}

/** The main key of a combo, in Electron's spelling. Null if it can't be one. */
function mainKey(event) {
  if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) return event.key.toUpperCase();
  if (NAMED_KEYS[event.key]) return NAMED_KEYS[event.key];
  if (/^F\d{1,2}$/.test(event.key)) return event.key;
  return null;
}

/**
 * Build an accelerator from a keydown.
 * @returns {{accelerator: string} | {error: string} | null}
 *   null while the user is still holding modifiers down (not an answer yet).
 */
export function acceleratorFromEvent(event) {
  if (MODIFIER_KEYS.includes(event.key)) return null;

  const key = mainKey(event);
  if (!key) return null;

  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push("CommandOrControl");
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");

  // A global shortcut with no modifier would swallow the key everywhere.
  if (parts.length === 0) return { error: "Include a modifier (Ctrl/Cmd/Alt) in the shortcut." };

  return { accelerator: [...parts, key].join("+") };
}
