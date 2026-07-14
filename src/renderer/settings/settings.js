import { formatAccelerator, acceleratorFromEvent } from "./accelerator.js";

const $ = (id) => document.getElementById(id);

const els = {
  key: $("key"),
  toggleKey: $("toggle"),
  model: $("model"),
  tones: $("tones"),
  autoLaunch: $("autolaunch"),
  chatContext: $("chatContext"),
  chatCloseWarning: $("chatCloseWarning"),
  status: $("status"),
  errbox: $("errbox"),
  save: $("save"),
  test: $("test"),
};

// Labels for the shortcut rows, for messages about them.
const SHORTCUT_LABELS = {
  shortcut: "Rewrite shortcut",
  chatShortcut: "Chat shortcut",
  chatCloseShortcut: "End-session shortcut",
};

// One entry per recordable shortcut: the setting it maps to, and its three elements.
const RECORDERS = [
  { id: "shortcut", box: "shortcutBox", text: "shortcutText", button: "recordShortcut" },
  {
    id: "chatShortcut",
    box: "chatShortcutBox",
    text: "chatShortcutText",
    button: "recordChatShortcut",
  },
  {
    id: "chatCloseShortcut",
    box: "chatCloseShortcutBox",
    text: "chatCloseShortcutText",
    button: "recordChatCloseShortcut",
  },
];

let tones = [];
let selectedTone = "professional";
const accelerators = {}; // setting id -> accelerator
let recordingId = null; // which shortcut is currently listening, if any

// ---- Status line -------------------------------------------------------------

function setStatus(text, kind = "") {
  els.status.textContent = text;
  els.status.className = kind;
  els.errbox.classList.remove("visible");
}

function setError(summary, detail = "") {
  els.status.textContent = summary;
  els.status.className = "err";
  els.errbox.textContent = detail;
  els.errbox.classList.toggle("visible", Boolean(detail));
}

// ---- Tones -------------------------------------------------------------------

function renderTones() {
  els.tones.replaceChildren(
    ...tones.map((tone) => {
      const label = document.createElement("label");
      label.className = tone.id === selectedTone ? "tone active" : "tone";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "tone";
      radio.checked = tone.id === selectedTone;
      radio.addEventListener("change", () => {
        selectedTone = tone.id;
        renderTones();
      });

      const title = document.createElement("span");
      title.textContent = tone.title;

      label.append(radio, title);
      return label;
    })
  );
}

// ---- Shortcut recording ------------------------------------------------------

function paintShortcuts() {
  for (const recorder of RECORDERS) {
    $(recorder.box).classList.remove("recording");
    $(recorder.button).textContent = "Change";
    $(recorder.text).textContent = formatAccelerator(accelerators[recorder.id]);
  }
}

function stopRecording() {
  if (!recordingId) {
    paintShortcuts();
    return;
  }
  recordingId = null;
  paintShortcuts();
  window.api.resumeShortcuts(); // restore the live global shortcuts
}

async function startRecording(id) {
  stopRecording();
  recordingId = id;

  // Mute the live global shortcuts so pressing one records it instead of firing it.
  await window.api.suspendShortcuts();

  const recorder = RECORDERS.find((r) => r.id === id);
  $(recorder.box).classList.add("recording");
  $(recorder.button).textContent = "Press keys…";
  $(recorder.text).textContent = "Press a combination…";
}

function onRecordingKeydown(event) {
  if (!recordingId) return;
  event.preventDefault();

  const result = acceleratorFromEvent(event);
  if (!result) return; // still holding modifiers

  const id = recordingId;

  if (result.error) {
    stopRecording();
    setError(result.error);
    return;
  }

  // Reject a combo already bound to another action, or only one of them would work.
  const clash = RECORDERS.find((r) => r.id !== id && accelerators[r.id] === result.accelerator);
  if (clash) {
    stopRecording();
    setError(`That shortcut is already used by "${SHORTCUT_LABELS[clash.id]}".`);
    return;
  }

  accelerators[id] = result.accelerator;
  stopRecording();
  setStatus("Shortcut set — click Save to apply.", "ok");
}

// ---- Load / save -------------------------------------------------------------

let ready = false; // true once load() has populated the form

async function load() {
  // Keep the buttons disabled until every field is populated — a half-loaded save would blank them.
  els.save.disabled = true;
  els.test.disabled = true;

  const { settings, models, tones: toneList } = await window.api.load();

  tones = toneList;
  selectedTone = settings.tone;
  renderTones();

  els.model.replaceChildren(
    ...models.map((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.label;
      return option;
    })
  );
  // Fall back to the first model if the saved one is no longer offered, not a blank select.
  els.model.value = models.some((m) => m.id === settings.model) ? settings.model : models[0]?.id;

  els.autoLaunch.checked = settings.autoLaunch;
  els.chatContext.value = settings.chatContext;
  // The chat's "don't show this again" box clears this; here is the way back.
  els.chatCloseWarning.checked = settings.chatCloseWarning;

  for (const recorder of RECORDERS) accelerators[recorder.id] = settings[recorder.id];
  paintShortcuts();

  // The key comes down its own channel — it is not part of the settings payload.
  els.key.value = await window.api.getApiKey();

  ready = true;
  els.save.disabled = false;
  els.test.disabled = false;
}

async function save() {
  if (!ready) return;

  const { saved, shortcuts } = await window.api.save({
    apiKey: els.key.value.trim(),
    model: els.model.value,
    tone: selectedTone,
    autoLaunch: els.autoLaunch.checked,
    chatContext: els.chatContext.value.trim(),
    chatCloseWarning: els.chatCloseWarning.checked,
    shortcut: accelerators.shortcut,
    chatShortcut: accelerators.chatShortcut,
    chatCloseShortcut: accelerators.chatCloseShortcut,
  });

  if (!saved) {
    setError("Couldn't save settings", "The settings file could not be written to disk.");
    return;
  }

  // Flag any shortcut the OS refused (e.g. another app already owns it).
  const rejected = Object.entries(shortcuts || {})
    .filter(([, ok]) => !ok)
    .map(([id]) => SHORTCUT_LABELS[id]);
  if (rejected.length) {
    setError(
      "Saved, but a shortcut was rejected",
      `${rejected.join(", ")} — try another combination.`
    );
    return;
  }

  setStatus("Saved.", "ok");
}

async function testKey() {
  if (!ready) return;
  if (!els.key.value.trim()) {
    setError("Enter an API key first.");
    return;
  }

  await save();
  setStatus(`Testing ${els.model.value}…`);

  const result = await window.api.testKey();
  if (result.ok) setStatus("Key works! ✓", "ok");
  else setError("Test failed", result.error);
}

// ---- Wiring ------------------------------------------------------------------

els.toggleKey.addEventListener("click", () => {
  const revealing = els.key.type === "password";
  els.key.type = revealing ? "text" : "password";
  els.toggleKey.textContent = revealing ? "Hide" : "Show";
});

for (const recorder of RECORDERS) {
  $(recorder.button).addEventListener("click", () => {
    if (recordingId === recorder.id) stopRecording();
    else startRecording(recorder.id);
  });
}

window.addEventListener("keydown", onRecordingKeydown);
// Stop on blur, or the global shortcuts would stay suspended (dead) until the user returns.
window.addEventListener("blur", () => {
  if (recordingId) stopRecording();
});
els.save.addEventListener("click", save);
els.test.addEventListener("click", testKey);
$("quit").addEventListener("click", () => window.api.quit());

load();
