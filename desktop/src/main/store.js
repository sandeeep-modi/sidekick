// Settings persisted as JSON in the app's userData folder.

const fs = require("fs");
const path = require("path");

const defaults = {
  apiKey: "",
  model: "gemini-3.1-flash-lite",
  tone: "professional",
  shortcut: "CommandOrControl+Shift+R",
  autoLaunch: false,
};

let file = null;
let data = {};

function init(userDataPath) {
  file = path.join(userDataPath, "settings.json");
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    data = {};
  }
}

function all() {
  return { ...defaults, ...data };
}

function set(patch) {
  data = { ...data, ...patch };
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch {}
  return all();
}

module.exports = { init, all, set, defaults };
