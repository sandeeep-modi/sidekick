// The Quick Chat popup: frameless, always-on-top, draggable and resizable.
// Remembers position and size. Every open starts a fresh session.

const path = require("path");
const { app, BrowserWindow, screen } = require("electron");
const { appIcon } = require("../icons");
const store = require("../store");

const DEFAULT_W = 360;
const DEFAULT_H = 460;
const MIN_W = 290;
const MIN_H = 340;
const PERSIST_DEBOUNCE_MS = 600;

let win = null;
let saveTimer = null;

// Bottom-right of the primary display, inset a little.
function defaultPosition(width, height) {
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.round(area.x + area.width - width - 32),
    y: Math.round(area.y + area.height - height - 32),
  };
}

// Is enough of this rectangle on some connected display to grab and drag? Guards
// against restoring onto a monitor that has since been unplugged — the window is
// frameless and off the taskbar, so off-screen means unreachable.
function isReachable(x, y, width, height) {
  const MIN_VISIBLE = 80;
  return screen.getAllDisplays().some(({ workArea: a }) => {
    const overlapX = Math.min(x + width, a.x + a.width) - Math.max(x, a.x);
    const overlapY = Math.min(y + height, a.y + a.height) - Math.max(y, a.y);
    return overlapX >= Math.min(MIN_VISIBLE, width) && overlapY >= Math.min(MIN_VISIBLE, height);
  });
}

function startPosition(width, height) {
  const saved = store.all().chatWindowPos;
  if (saved && isReachable(saved.x, saved.y, width, height)) return saved;
  return defaultPosition(width, height);
}

function persistBounds() {
  if (!win) return;
  const [x, y] = win.getPosition();
  const [w, h] = win.getSize();
  store.set({ chatWindowPos: { x, y }, chatWindowSize: { w, h } });
}

function createChatWindow() {
  if (win) return win;

  const size = store.all().chatWindowSize;
  const width = size?.w || DEFAULT_W;
  const height = size?.h || DEFAULT_H;
  const { x, y } = startPosition(width, height);

  win = new BrowserWindow({
    width,
    height,
    minWidth: MIN_W,
    minHeight: MIN_H,
    x,
    y,
    frame: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    title: "Sidekick Chat",
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, "..", "..", "preload", "chat.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, "floating");
  win.loadFile(path.join(__dirname, "..", "..", "renderer", "chat", "index.html"));

  const debouncedPersist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistBounds, PERSIST_DEBOUNCE_MS);
  };
  win.on("move", debouncedPersist);
  win.on("resize", debouncedPersist);

  // Hide instead of close — but let the close through when the app is really
  // quitting, or this handler would veto app.quit() and the app could never exit.
  win.on("close", (e) => {
    persistBounds();
    if (app.isQuitting) return;
    e.preventDefault();
    win.hide();
  });

  return win;
}

/** Toggle shortcut: show or hide, no confirmation either way. */
function toggleChatWindow() {
  const w = createChatWindow();

  if (w.isVisible()) {
    w.hide();
    return;
  }

  // Push current settings on every open, so Settings changes apply without a restart.
  const { model, chatCloseWarning } = store.all();
  w.webContents.send("chat:reset", { model, closeWarning: chatCloseWarning });
  w.show();
  w.focus();
}

function hideChatWindow() {
  if (!win) return;
  persistBounds();
  win.hide();
}

/** End-session shortcut: the renderer decides whether to confirm first. */
function requestCloseChatWindow() {
  if (win?.isVisible()) win.webContents.send("chat:close-requested");
}

const getChatWindow = () => win;

module.exports = {
  createChatWindow,
  toggleChatWindow,
  hideChatWindow,
  requestCloseChatWindow,
  getChatWindow,
};
