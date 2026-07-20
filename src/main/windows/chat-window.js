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

function defaultPosition(width, height) {
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.round(area.x + area.width - width - 32),
    y: Math.round(area.y + area.height - height - 32),
  };
}

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

  win.on("close", (e) => {
    persistBounds();
    if (app.isQuitting) return; // let close through when quitting, else this vetoes app.quit()
    e.preventDefault();
    win.hide();
  });

  return win;
}

function toggleChatWindow() {
  const w = createChatWindow();

  if (w.isVisible()) {
    w.hide();
    return;
  }

  const { chatModel } = store.all();
  w.webContents.send("chat:refresh", { model: chatModel });
  w.show();
  w.focus();
}

function hideChatWindow() {
  if (!win) return;
  persistBounds();
  win.hide();
}

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
