// The floating "Rewriting…" spinner. It must never take focus, or the paste
// would land in this window instead of the user's app.

const path = require("path");
const { BrowserWindow, screen } = require("electron");

const W = 240;
const H = 62;
let hud = null;

function ensureOverlay() {
  if (hud) return hud;
  hud = new BrowserWindow({
    width: W,
    height: H,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  hud.setAlwaysOnTop(true, "screen-saver");
  hud.setIgnoreMouseEvents(true);
  hud.loadFile(path.join(__dirname, "..", "renderer", "overlay", "index.html"));
  return hud;
}

function positionAtCursor() {
  const pt = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(pt).workArea;
  const x = Math.max(area.x, Math.min(pt.x + 14, area.x + area.width - W));
  const y = Math.max(area.y, Math.min(pt.y + 18, area.y + area.height - H));
  ensureOverlay().setBounds({ x: Math.round(x), y: Math.round(y), width: W, height: H });
}

async function setState(state, text) {
  const js = `window.setState && window.setState(${JSON.stringify(state)}, ${JSON.stringify(text || "")})`;
  try {
    await ensureOverlay().webContents.executeJavaScript(js);
  } catch {}
}

function show() {
  ensureOverlay().showInactive();
}

function hide() {
  if (hud) hud.hide();
}

module.exports = { ensureOverlay, positionAtCursor, setState, show, hide };
