// Tray and window icons, loaded from the master PNGs in icons/ (same source as the installer icons).

const path = require("path");
const { nativeImage } = require("electron");

const ICONS_DIR = path.join(__dirname, "..", "..", "icons");
const load = (name) => nativeImage.createFromPath(path.join(ICONS_DIR, name));

const trayIcon = () => load("icon-32.png").resize({ width: 16, height: 16 });
const appIcon = () => load("icon-256.png");

module.exports = { trayIcon, appIcon };
