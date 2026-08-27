const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let dir = null;

// Random suffix, not a counter: a counter restarts at 0 with the app and can
// reuse an id minted in the same millisecond of an earlier run.
const makeId = () => `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;

function init(userDataPath) {
  dir = path.join(userDataPath, "chats");
  fs.mkdirSync(dir, { recursive: true });
}

function fileFor(id) {
  // Path-traversal guard: reject ids that could escape the chats directory.
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error("Invalid chat id.");
  return path.join(dir, `${id}.json`);
}

function titleFrom(history) {
  const first = history.find((t) => t.role === "user");
  const text = (first?.text || "Saved chat").replace(/\s+/g, " ").trim();
  return text.length > 60 ? `${text.slice(0, 57)}...` : text || "Saved chat";
}

function save(history) {
  if (!Array.isArray(history) || history.length === 0) return null;

  const id = makeId();
  const record = { id, title: titleFrom(history), savedAt: Date.now(), history };
  const file = fileFor(id);

  try {
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(record, null, 2));
    fs.renameSync(`${file}.tmp`, file);
  } catch {
    return null;
  }

  return { id: record.id, title: record.title, savedAt: record.savedAt };
}

function list() {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const items = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, name), "utf8");
      const { id, title, savedAt } = JSON.parse(raw);
      if (id) items.push({ id, title, savedAt });
    } catch {
      // skip an unreadable or malformed chat file rather than losing the list
    }
  }
  return items.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

function load(id) {
  try {
    const record = JSON.parse(fs.readFileSync(fileFor(id), "utf8"));
    return Array.isArray(record.history) ? record : null;
  } catch {
    return null;
  }
}

function remove(id) {
  try {
    fs.unlinkSync(fileFor(id));
    return true;
  } catch {
    return false;
  }
}

module.exports = { init, save, list, load, remove };
