// Tray and window icons, loaded straight from the master PNGs in icons/.
// The installer's .ico/.icns are derived from the same files by `npm run icons`.

const path = require("path");
const { nativeImage } = require("electron");

const ICONS_DIR = path.join(__dirname, "..", "..", "icons");
const load = (name) => nativeImage.createFromPath(path.join(ICONS_DIR, name));

const trayIcon = () => load("icon-32.png").resize({ width: 16, height: 16 });
const appIcon = () => load("icon-256.png");

module.exports = { trayIcon, appIcon };
