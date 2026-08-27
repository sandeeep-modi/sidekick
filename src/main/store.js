const fs = require("fs");
const path = require("path");
const secret = require("./secret");
const { DEFAULT_MODEL } = require("../gemini/models");
const { DEFAULT_TONE } = require("../gemini/tones");

const DEFAULTS = {
  apiKey: "",
  chatModel: DEFAULT_MODEL,
  rewriteModel: DEFAULT_MODEL,
  tone: DEFAULT_TONE,
  shortcut: "CommandOrControl+Shift+R",
  autoLaunch: false,
  chatContext: "",
  chatShortcut: "CommandOrControl+Shift+C",
  chatCloseShortcut: "CommandOrControl+Shift+E",
  chatCloseWarning: true,
  chatWindowPos: null,
  chatWindowSize: null,
};

let file = null;
let data = {};

function fromDisk(raw) {
  const obj = JSON.parse(raw);
  if (typeof obj.apiKeyEnc === "string") {
    obj.apiKey = secret.decrypt(obj.apiKeyEnc);
    delete obj.apiKeyEnc;
  }
  return obj;
}

function toDisk(mem) {
  const out = { ...mem };
  const key = out.apiKey || "";
  delete out.apiKey;
  if (!key) return out;

  // Keep the key even if the keystore refuses: encrypt() returns "" on failure,
  // and writing that back would wipe the key the user just entered.
  const encrypted = secret.available() ? secret.encrypt(key) : "";
  if (encrypted) out.apiKeyEnc = encrypted;
  else out.apiKey = key; // intentional: no OS keystore available, plaintext fallback

  return out;
}

function writeToDisk() {
  // atomic temp-file + rename: must not be replaced with a direct write
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(toDisk(data), null, 2));
  fs.renameSync(tmp, file);
}

function init(userDataPath) {
  fs.mkdirSync(userDataPath, { recursive: true });
  file = path.join(userDataPath, "settings.json");

  let hadPlaintextKey = false;
  try {
    const raw = fs.readFileSync(file, "utf8");
    hadPlaintextKey = /"apiKey"\s*:/.test(raw);
    data = fromDisk(raw);
  } catch (error) {
    data = {};
    if (error.code !== "ENOENT") {
      try {
        fs.renameSync(file, `${file}.corrupt`);
      } catch {
        // deliberately ignored
      }
      return { recovered: false };
    }
  }

  if (typeof data.model === "string") {
    if (data.chatModel === undefined) data.chatModel = data.model;
    if (data.rewriteModel === undefined) data.rewriteModel = data.model;
    delete data.model;
  }

  if (hadPlaintextKey && data.apiKey && secret.available()) {
    try {
      writeToDisk();
    } catch {
      // deliberately ignored
    }
  }

  return { recovered: true };
}

function all() {
  return { ...DEFAULTS, ...data };
}

function publicSettings() {
  const { apiKey, ...rest } = all();
  return { ...rest, hasApiKey: Boolean(apiKey) };
}

function set(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) data[key] = value;
  }

  try {
    writeToDisk();
    return true;
  } catch {
    return false;
  }
}

module.exports = { init, all, publicSettings, set };
