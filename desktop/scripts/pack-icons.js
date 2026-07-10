// Packs the app icons from the master PNGs in build/icon-source/ into the
// formats each target needs. Source of truth = build/icon-source/icon-<size>.png.
// Run: `npm run icons`

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "icon-src"); // master art (committed)
const buildDir = path.join(root, "build"); // generated packaging icons (git-ignored)
const assetsDir = path.join(root, "assets");
const extIconsDir = path.join(root, "..", "extension", "icons");

const png = {};
for (const s of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
  png[s] = fs.readFileSync(path.join(srcDir, `icon-${s}.png`));
}

// ICO — directory of embedded PNGs (Windows Vista+).
function buildIco(sizes) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  const dir = Buffer.alloc(16 * sizes.length);
  let offset = 6 + 16 * sizes.length;
  const datas = [];
  sizes.forEach((s, i) => {
    const b = i * 16;
    dir.writeUInt8(s >= 256 ? 0 : s, b);
    dir.writeUInt8(s >= 256 ? 0 : s, b + 1);
    dir.writeUInt16LE(1, b + 4);
    dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(png[s].length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += png[s].length;
    datas.push(png[s]);
  });
  return Buffer.concat([header, dir, ...datas]);
}

// ICNS — sequence of typed PNG elements (macOS).
function buildIcns(entries) {
  const parts = [];
  for (const [type, s] of entries) {
    const h = Buffer.alloc(8);
    h.write(type, 0, "ascii");
    h.writeUInt32BE(png[s].length + 8, 4);
    parts.push(h, png[s]);
  }
  const body = Buffer.concat(parts);
  const header = Buffer.alloc(8);
  header.write("icns", 0, "ascii");
  header.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([header, body]);
}

fs.mkdirSync(assetsDir, { recursive: true });
fs.mkdirSync(extIconsDir, { recursive: true });

fs.writeFileSync(path.join(buildDir, "icon.png"), png[1024]);
fs.writeFileSync(path.join(buildDir, "icon.ico"), buildIco([16, 24, 32, 48, 64, 128, 256]));
fs.writeFileSync(
  path.join(buildDir, "icon.icns"),
  buildIcns([
    ["icp4", 16], ["icp5", 32], ["icp6", 64],
    ["ic07", 128], ["ic08", 256], ["ic09", 512], ["ic10", 1024],
    ["ic11", 32], ["ic12", 64], ["ic13", 256], ["ic14", 512],
  ])
);

// Runtime icons (tray/window), bundled in the app.
for (const s of [16, 32, 64, 256]) {
  fs.writeFileSync(path.join(assetsDir, `icon-${s}.png`), png[s]);
}

// Chrome extension icons (kept in sync).
for (const s of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(extIconsDir, `icon-${s}.png`), png[s]);
}

console.log("Packed icons -> build/ (ico, icns, png), assets/, extension/icons/");
