// Packs the master PNGs in icons/ into the bundled formats the installers need:
// icon.ico (Windows), icon.icns (macOS), icon.png. Run: `npm run icons`
//
// The app itself loads the PNGs from icons/ directly at runtime — only these
// packed formats have to be generated, and build/ is git-ignored because of it.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ICONS_DIR = path.join(ROOT, "icons"); // master art (committed)
const BUILD_DIR = path.join(ROOT, "build"); // packaging icons (generated)

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

// macOS icon types, each mapping to one PNG size.
const ICNS_ENTRIES = [
  ["icp4", 16],
  ["icp5", 32],
  ["icp6", 64],
  ["ic07", 128],
  ["ic08", 256],
  ["ic09", 512],
  ["ic10", 1024],
  ["ic11", 32],
  ["ic12", 64],
  ["ic13", 256],
  ["ic14", 512],
];

const png = {};
for (const size of SIZES) {
  png[size] = fs.readFileSync(path.join(ICONS_DIR, `icon-${size}.png`));
}

/** ICO: a directory of embedded PNGs (Windows Vista+). */
function buildIco(sizes) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);

  const directory = Buffer.alloc(16 * sizes.length);
  let offset = header.length + directory.length;

  sizes.forEach((size, i) => {
    const entry = i * 16;
    const dimension = size >= 256 ? 0 : size; // 0 means 256 in the ICO format

    directory.writeUInt8(dimension, entry);
    directory.writeUInt8(dimension, entry + 1);
    directory.writeUInt16LE(1, entry + 4); // color planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(png[size].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);

    offset += png[size].length;
  });

  return Buffer.concat([header, directory, ...sizes.map((size) => png[size])]);
}

/** ICNS: a sequence of typed PNG elements (macOS). */
function buildIcns(entries) {
  const parts = [];

  for (const [type, size] of entries) {
    const header = Buffer.alloc(8);
    header.write(type, 0, "ascii");
    header.writeUInt32BE(png[size].length + 8, 4);
    parts.push(header, png[size]);
  }

  const body = Buffer.concat(parts);
  const header = Buffer.alloc(8);
  header.write("icns", 0, "ascii");
  header.writeUInt32BE(body.length + 8, 4);

  return Buffer.concat([header, body]);
}

fs.mkdirSync(BUILD_DIR, { recursive: true });

fs.writeFileSync(path.join(BUILD_DIR, "icon.png"), png[1024]);
fs.writeFileSync(path.join(BUILD_DIR, "icon.ico"), buildIco(ICO_SIZES));
fs.writeFileSync(path.join(BUILD_DIR, "icon.icns"), buildIcns(ICNS_ENTRIES));

console.log("Packed icons/ -> build/icon.ico, build/icon.icns, build/icon.png");
