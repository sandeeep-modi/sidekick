import { formatAccelerator, acceleratorFromEvent } from "./accelerator.js";

const $ = (id) => document.getElementById(id);

const els = {
  key: $("key"),
  toggleKey: $("toggle"),
  rewriteModel: $("rewriteModel"),
  chatModel: $("chatModel"),
  tones: $("tones"),
  autoLaunch: $("autolaunch"),
  chatContext: $("chatContext"),
  chatCloseWarning: $("chatCloseWarning"),
  status: $("status"),
  errbox: $("errbox"),
  save: $("save"),
  test: $("test"),
  welcome: $("welcome"),
  main: $("main"),
  welcomeKey: $("welcomeKey"),
  welcomeToggle: $("welcomeToggle"),
  getKey: $("getKey"),
  continue: $("continue"),
  welcomeStatus: $("welcomeStatus"),
  welcomeErrbox: $("welcomeErrbox"),
};

const SHORTCUT_LABELS = {
  shortcut: "Rewrite shortcut",
  chatShortcut: "Chat shortcut",
  chatCloseShortcut: "End-session shortcut",
};

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
const accelerators = {};
let recordingId = null;

let statusEls = { status: () => els.status, errbox: () => els.errbox };

function setStatus(text, kind = "") {
  const status = statusEls.status();
  status.textContent = text;
  status.className = kind;
  statusEls.errbox().classList.remove("visible");
}

function setError(summary, detail = "") {
  const status = statusEls.status();
  status.textContent = summary;
  status.className = "err";
  const errbox = statusEls.errbox();
  errbox.textContent = detail;
  errbox.classList.toggle("visible", Boolean(detail));
}

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
  window.api.resumeShortcuts();
}

async function startRecording(id) {
  stopRecording();
  recordingId = id;
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
  if (!result) return;

  const id = recordingId;

  if (result.error) {
    stopRecording();
    setError(result.error);
    return;
  }

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

let ready = false;

async function load() {
  els.save.disabled = true;
  els.test.disabled = true;

  const { settings, models, tones: toneList } = await window.api.load();

  tones = toneList;
  selectedTone = settings.tone;
  renderTones();

  const fillModelSelect = (select, saved) => {
    select.replaceChildren(
      ...models.map((model) => {
        const option = document.createElement("option");
        option.value = model.id;
        option.textContent = model.label;
        return option;
      })
    );
    select.value = models.some((m) => m.id === saved) ? saved : models[0]?.id;
  };
  fillModelSelect(els.rewriteModel, settings.rewriteModel);
  fillModelSelect(els.chatModel, settings.chatModel);

  els.autoLaunch.checked = settings.autoLaunch;
  els.chatContext.value = settings.chatContext;
  els.chatCloseWarning.checked = settings.chatCloseWarning;

  for (const recorder of RECORDERS) accelerators[recorder.id] = settings[recorder.id];
  paintShortcuts();

  els.key.value = await window.api.getApiKey();

  ready = true;
  els.save.disabled = false;
  els.test.disabled = false;

  showScreen(els.key.value.trim() ? "main" : "welcome");
}

function showScreen(name) {
  const welcome = name === "welcome";
  els.welcome.hidden = !welcome;
  els.main.hidden = welcome;
  statusEls = welcome
    ? { status: () => els.welcomeStatus, errbox: () => els.welcomeErrbox }
    : { status: () => els.status, errbox: () => els.errbox };
}

async function save() {
  if (!ready) return;

  const { saved, shortcuts, autoLaunchApplied } = await window.api.save({
    apiKey: els.key.value.trim(),
    rewriteModel: els.rewriteModel.value,
    chatModel: els.chatModel.value,
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

  if (autoLaunchApplied === false) {
    setError(
      "Saved, but start at login couldn't be enabled",
      "Move Sidekick to your Applications folder (macOS) or a permanent location (Windows), then try again."
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
  setStatus(`Testing ${els.rewriteModel.value}…`);

  const result = await window.api.testKey();
  if (result.ok) setStatus("Key works! ✓", "ok");
  else setError("Test failed", result.error);
}

async function onContinue() {
  if (!ready) return;

  const key = els.welcomeKey.value.trim();
  if (!key) {
    setError("Paste your API key to continue.");
    return;
  }

  els.continue.disabled = true;
  els.key.value = key; // shared save() reads from the main field
  setStatus("Checking your key…");

  await save();
  const result = await window.api.testKey();

  if (result.ok) {
    setStatus("");
    showScreen("main");
    setStatus("You're all set! ✓", "ok");
  } else {
    setError("That key didn't work", result.error);
  }
  els.continue.disabled = false;
}

els.toggleKey.addEventListener("click", () => {
  const revealing = els.key.type === "password";
  els.key.type = revealing ? "text" : "password";
  els.toggleKey.textContent = revealing ? "Hide" : "Show";
});

els.welcomeToggle.addEventListener("click", () => {
  const revealing = els.welcomeKey.type === "password";
  els.welcomeKey.type = revealing ? "text" : "password";
  els.welcomeToggle.textContent = revealing ? "Hide" : "Show";
});

els.getKey.addEventListener("click", () => window.api.openKeyPage());
els.continue.addEventListener("click", onContinue);
els.welcomeKey.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onContinue();
});

for (const recorder of RECORDERS) {
  $(recorder.button).addEventListener("click", () => {
    if (recordingId === recorder.id) stopRecording();
    else startRecording(recorder.id);
  });
}

window.addEventListener("keydown", onRecordingKeydown);
window.addEventListener("blur", () => {
  if (recordingId) stopRecording();
});
function showTab(name) {
  if (recordingId) stopRecording();
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.tab === name);
  }
  for (const panel of document.querySelectorAll(".panel")) {
    panel.hidden = panel.dataset.panel !== name;
  }
}

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
}

els.save.addEventListener("click", save);
els.test.addEventListener("click", testKey);
$("quit").addEventListener("click", () => window.api.quit());

load();
