const $ = (id) => document.getElementById(id);

const keyInput = $("key");
const toggleBtn = $("toggle");
const modelSel = $("model");
const tonesEl = $("tones");
const shortcutBox = $("shortcut");
const shortcutText = $("shortcutText");
const recordBtn = $("record");
const autolaunch = $("autolaunch");
const statusEl = $("status");
const errbox = $("errbox");

let tones = [];
let currentTone = "professional";
let currentShortcut = "CommandOrControl+Shift+R";
let recording = false;

function setStatus(text, kind) {
  statusEl.textContent = text || "";
  statusEl.className = kind || "";
  errbox.style.display = "none";
}

function setError(short, detail) {
  statusEl.textContent = short;
  statusEl.className = "err";
  errbox.textContent = detail || "";
  errbox.style.display = detail ? "block" : "none";
}

async function load() {
  const { settings, models, tones: toneList } = await window.api.load();
  tones = toneList;

  keyInput.value = settings.apiKey || "";

  modelSel.innerHTML = "";
  for (const m of models) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    modelSel.appendChild(opt);
  }
  modelSel.value = settings.model;

  currentTone = settings.tone;
  renderTones();

  currentShortcut = settings.shortcut;
  shortcutText.textContent = prettyAccel(currentShortcut);

  autolaunch.checked = !!settings.autoLaunch;
}

function renderTones() {
  tonesEl.innerHTML = "";
  for (const t of tones) {
    const el = document.createElement("label");
    el.className = "tone" + (t.id === currentTone ? " active" : "");
    el.innerHTML = `<input type="radio" name="tone" value="${t.id}" ${
      t.id === currentTone ? "checked" : ""
    }/> <span>${t.title}</span>`;
    el.querySelector("input").addEventListener("change", () => {
      currentTone = t.id;
      renderTones();
    });
    tonesEl.appendChild(el);
  }
}

toggleBtn.addEventListener("click", () => {
  const revealing = keyInput.type === "password";
  keyInput.type = revealing ? "text" : "password";
  toggleBtn.textContent = revealing ? "Hide" : "Show";
});

// ---- Shortcut recorder ----------------------------------------------------

function prettyAccel(accel) {
  const mac = navigator.platform.toLowerCase().includes("mac");
  return accel
    .replace("CommandOrControl", mac ? "Cmd" : "Ctrl")
    .replace("Alt", mac ? "Option" : "Alt")
    .replace(/\+/g, " + ");
}

recordBtn.addEventListener("click", () => {
  recording = !recording;
  shortcutBox.classList.toggle("recording", recording);
  recordBtn.textContent = recording ? "Press keys…" : "Change";
  shortcutText.textContent = recording ? "Press a combination…" : prettyAccel(currentShortcut);
});

window.addEventListener("keydown", (e) => {
  if (!recording) return;
  e.preventDefault();
  if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;

  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");

  const main = normalizeKey(e);
  if (!main) return;
  if (parts.length === 0) {
    setError("Include a modifier (Ctrl/Cmd/Alt) in the shortcut.");
    return;
  }
  parts.push(main);

  currentShortcut = parts.join("+");
  recording = false;
  shortcutBox.classList.remove("recording");
  recordBtn.textContent = "Change";
  shortcutText.textContent = prettyAccel(currentShortcut);
  setStatus("Shortcut set — click Save to apply.", "ok");
});

function normalizeKey(e) {
  const k = e.key;
  if (k.length === 1 && /[a-z0-9]/i.test(k)) return k.toUpperCase();
  const map = {
    " ": "Space",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Enter: "Return",
    ".": "Period",
    ",": "Comma",
    "/": "Slash",
    ";": "Semicolon",
  };
  if (map[k]) return map[k];
  if (/^F\d{1,2}$/.test(k)) return k;
  return null;
}

// ---- Save / Test / Quit ---------------------------------------------------

async function save() {
  await window.api.save({
    apiKey: keyInput.value.trim(),
    model: modelSel.value,
    tone: currentTone,
    shortcut: currentShortcut,
    autoLaunch: autolaunch.checked,
  });
  setStatus("Saved.", "ok");
}

$("save").addEventListener("click", save);

$("test").addEventListener("click", async () => {
  if (!keyInput.value.trim()) {
    setError("Enter an API key first.");
    return;
  }
  await save();
  setStatus("Testing " + modelSel.value + "…");
  const resp = await window.api.testKey();
  if (resp.ok) setStatus("Key works! ✓", "ok");
  else setError("Test failed", resp.error);
});

$("quit").addEventListener("click", () => window.api.quit());

load();
