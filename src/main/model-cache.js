const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MODELS, fetchTopModels } = require("../gemini/models");

const REFRESH_MS = 7 * 24 * 60 * 60 * 1000; // ask Google for the model list once a week
const TICK_MS = 6 * 60 * 60 * 1000; // so a machine that never restarts still refreshes on time

let file = null;
let cache = null; // { keyId, fetchedAt, models }
let inFlight = null; // { keyId, promise }
const listeners = [];

// The cache is tied to a key without storing the key itself.
const keyIdOf = (apiKey) =>
  apiKey ? crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16) : "";

function isUsable(entry) {
  return Boolean(
    entry &&
    typeof entry.keyId === "string" &&
    Number.isFinite(entry.fetchedAt) &&
    Array.isArray(entry.models) &&
    entry.models.length > 0 &&
    entry.models.every((m) => m && typeof m.id === "string" && typeof m.label === "string")
  );
}

function isFresh(entry, keyId, now) {
  if (!isUsable(entry) || entry.keyId !== keyId) return false;
  // a fetchedAt in the future means the clock moved: treat it as stale
  return now >= entry.fetchedAt && now - entry.fetchedAt < REFRESH_MS;
}

function write() {
  try {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
    fs.renameSync(tmp, file);
  } catch {
    // a cache we can't persist is still good in memory for this session
  }
}

function emit(models) {
  for (const listener of listeners) {
    try {
      listener(models);
    } catch {
      // deliberately ignored
    }
  }
}

async function fetchAndStore(apiKey, keyId) {
  const models = await fetchTopModels(apiKey);
  const previous = cache?.models;
  cache = { keyId, fetchedAt: Date.now(), models };
  write();
  // only announce a change: the first fetch is already returned to its caller
  if (previous && JSON.stringify(previous) !== JSON.stringify(models)) emit(models);
  return models;
}

function start(apiKey, keyId) {
  if (!inFlight || inFlight.keyId !== keyId) {
    const promise = fetchAndStore(apiKey, keyId);
    inFlight = { keyId, promise };
    promise
      .catch(() => {})
      .then(() => {
        if (inFlight?.promise === promise) inFlight = null;
      });
  }
  return inFlight.promise;
}

function init(userDataPath) {
  file = path.join(userDataPath, "models-cache.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (isUsable(parsed)) cache = parsed;
  } catch {
    // no cache yet, or it's unreadable — either way we just refetch
  }
}

async function get(apiKey) {
  if (!apiKey) return MODELS;

  const keyId = keyIdOf(apiKey);
  if (isFresh(cache, keyId, Date.now())) return cache.models;

  const stale = isUsable(cache) && cache.keyId === keyId ? cache.models : null;
  if (stale) {
    // don't block the window on the network: serve the old list, push any change
    start(apiKey, keyId).catch((error) => console.error("Model refresh failed:", error));
    return stale;
  }

  try {
    return await start(apiKey, keyId);
  } catch (error) {
    console.error("Model lookup failed:", error);
    return MODELS;
  }
}

// Fire-and-forget: the refreshed list reaches the UI through onUpdated.
function refreshNow(apiKey) {
  if (!apiKey) return;
  const keyId = keyIdOf(apiKey);
  if (isFresh(cache, keyId, Date.now())) return;
  start(apiKey, keyId).catch((error) => console.error("Model refresh failed:", error));
}

function onUpdated(listener) {
  listeners.push(listener);
}

function startPeriodicRefresh(getApiKey) {
  const timer = setInterval(() => refreshNow(getApiKey()), TICK_MS);
  timer.unref?.();
  return timer;
}

module.exports = { init, get, refreshNow, onUpdated, startPeriodicRefresh };
