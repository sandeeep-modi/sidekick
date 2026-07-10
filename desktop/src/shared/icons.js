// Runtime tray/window icons, loaded from the generated PNGs in assets/.
// Regenerate the source art with `npm run icons`.

const path = require("path");
const { nativeImage } = require("electron");

const ASSETS = path.join(__dirname, "..", "..", "assets");
const load = (name) => nativeImage.createFromPath(path.join(ASSETS, name));

module.exports = {
  trayIcon: () => load("icon-32.png").resize({ width: 16, height: 16 }),
  appIcon: () => load("icon-256.png"),
};
