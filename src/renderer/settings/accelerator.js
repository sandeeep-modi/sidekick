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

export function formatAccelerator(accelerator) {
  return accelerator
    .replace("CommandOrControl", IS_MAC ? "Cmd" : "Ctrl")
    .replace("Alt", IS_MAC ? "Option" : "Alt")
    .replace(/\+/g, " + ");
}

function mainKey(event) {
  if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) return event.key.toUpperCase();
  if (NAMED_KEYS[event.key]) return NAMED_KEYS[event.key];
  if (/^F\d{1,2}$/.test(event.key)) return event.key;
  return null;
}

export function acceleratorFromEvent(event) {
  if (MODIFIER_KEYS.includes(event.key)) return null;

  const key = mainKey(event);
  if (!key) return null;

  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push("CommandOrControl");
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");

  if (parts.length === 0) return { error: "Include a modifier (Ctrl/Cmd/Alt) in the shortcut." };

  return { accelerator: [...parts, key].join("+") };
}
