// The floating "Rewriting…" spinner. It must never take focus, or the paste
// would land in this window instead of the user's app.

const path = require("path");
const { BrowserWindow, screen } = require("electron");

const W = 240;
const H = 62;

let win = null;

function createOverlayWindow() {
  if (win) return win;

  win = new BrowserWindow({
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
    focusable: false, // with showInactive(), this is what keeps focus in the user's app
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "..", "preload", "overlay.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setIgnoreMouseEvents(true);
  win.loadFile(path.join(__dirname, "..", "..", "renderer", "overlay", "index.html"));

  return win;
}

/** Park the spinner just below-right of the cursor, clamped to the display. */
function positionAtCursor() {
  const point = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(point).workArea;
  const x = Math.max(area.x, Math.min(point.x + 14, area.x + area.width - W));
  const y = Math.max(area.y, Math.min(point.y + 18, area.y + area.height - H));

  createOverlayWindow().setBounds({ x: Math.round(x), y: Math.round(y), width: W, height: H });
}

/** @param {"loading"|"done"|"error"} state */
function setOverlayState(state, text = "") {
  createOverlayWindow().webContents.send("overlay:state", { state, text });
}

const showOverlay = () => createOverlayWindow().showInactive();
const hideOverlay = () => win?.hide();

module.exports = {
  createOverlayWindow,
  positionAtCursor,
  setOverlayState,
  showOverlay,
  hideOverlay,
};
