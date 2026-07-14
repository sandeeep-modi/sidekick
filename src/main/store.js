// Settings persisted as JSON in userData. The API key is plaintext in memory but
// encrypted on disk (see secret.js); the rest is stored as-is.

const fs = require("fs");
const path = require("path");
const secret = require("./secret");
const { DEFAULT_MODEL } = require("../gemini/models");
const { DEFAULT_TONE } = require("../gemini/tones");

const DEFAULTS = {
  apiKey: "",
  model: DEFAULT_MODEL,
  tone: DEFAULT_TONE,
  shortcut: "CommandOrControl+Shift+R",
  autoLaunch: false,
  chatContext: "", // standing instruction prepended to every chat session
  chatShortcut: "CommandOrControl+Shift+C", // open / toggle chat
  chatCloseShortcut: "CommandOrControl+Shift+E", // end session & close
  chatCloseWarning: true, // confirm before discarding a session
  chatWindowPos: null, // { x, y }
  chatWindowSize: null, // { w, h }
};

let file = null;
let data = {}; // in-memory: apiKey is plaintext here

// On disk the key is `apiKeyEnc` (base64 ciphertext), not `apiKey`.
function fromDisk(raw) {
  const obj = JSON.parse(raw);
  if (typeof obj.apiKeyEnc === "string") {
    obj.apiKey = secret.decrypt(obj.apiKeyEnc);
    delete obj.apiKeyEnc;
  }
  return obj; // a legacy file's plaintext `apiKey` is left as-is and re-encrypted on next write
}

function toDisk(mem) {
  const out = { ...mem };
  const key = out.apiKey || "";
  delete out.apiKey;

  if (key && secret.available()) {
    out.apiKeyEnc = secret.encrypt(key);
  } else if (key) {
    out.apiKey = key; // no OS keystore available — a readable key beats a lost one
  }
  return out;
}

function writeToDisk() {
  // Temp file + atomic rename, so a crash mid-write can't truncate settings.json.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(toDisk(data), null, 2));
  fs.renameSync(tmp, file);
}

function init(userDataPath) {
  // The userData folder may not exist yet on first run.
  fs.mkdirSync(userDataPath, { recursive: true });
  file = path.join(userDataPath, "settings.json");

  let hadPlaintextKey = false;
  try {
    const raw = fs.readFileSync(file, "utf8");
    hadPlaintextKey = /"apiKey"\s*:/.test(raw); // a key not yet encrypted at rest
    data = fromDisk(raw);
  } catch (error) {
    data = {};
    // Preserve a corrupt file instead of overwriting it with defaults and losing the key.
    if (error.code !== "ENOENT") {
      try {
        fs.renameSync(file, `${file}.corrupt`);
      } catch {
        // Best effort — if we can't preserve it, defaults still let the app run.
      }
      return { recovered: false };
    }
  }

  // Upgrade a legacy plaintext key to encrypted-at-rest immediately.
  if (hadPlaintextKey && data.apiKey && secret.available()) {
    try {
      writeToDisk();
    } catch {
      // Not fatal — it stays plaintext and migrates on the next successful write.
    }
  }

  return { recovered: true };
}

/** Every setting, including the API key. Main process only — never hand this to a renderer. */
function all() {
  return { ...DEFAULTS, ...data };
}

/** Settings minus the API key: what renderers are allowed to see. */
function publicSettings() {
  const { apiKey, ...rest } = all();
  return { ...rest, hasApiKey: Boolean(apiKey) };
}

/**
 * Merge a patch and persist it.
 * @returns {boolean} whether the write reached disk (false = the caller should tell the user).
 */
function set(patch) {
  // Drop undefined values, or they'd override a default (e.g. blank out a shortcut).
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) data[key] = value;
  }

  try {
    writeToDisk();
    return true;
  } catch {
    // Disk full / read-only / locked — keep the in-memory value so the session works.
    return false;
  }
}

module.exports = { init, all, publicSettings, set, DEFAULTS };
