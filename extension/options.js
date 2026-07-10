const keyInput = document.getElementById("key");
const toggleBtn = document.getElementById("toggle");
const modelSel = document.getElementById("model");
const saveBtn = document.getElementById("save");
const testBtn = document.getElementById("test");
const statusEl = document.getElementById("status");

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind || "";
}

// Load existing settings (key stays masked — field type is "password").
chrome.storage.sync.get(["apiKey", "model"]).then(({ apiKey, model }) => {
  if (apiKey) keyInput.value = apiKey;
  if (model) modelSel.value = model;
});

toggleBtn.addEventListener("click", () => {
  const revealing = keyInput.type === "password";
  keyInput.type = revealing ? "text" : "password";
  toggleBtn.textContent = revealing ? "Hide" : "Show";
});

saveBtn.addEventListener("click", async () => {
  const apiKey = keyInput.value.trim();
  await chrome.storage.sync.set({ apiKey, model: modelSel.value });
  setStatus(apiKey ? "Saved." : "Key cleared.", "ok");
});

testBtn.addEventListener("click", async () => {
  const apiKey = keyInput.value.trim();
  if (!apiKey) {
    setStatus("Enter a key first.", "err");
    return;
  }
  // Persist first so the test uses the currently-selected key + model.
  await chrome.storage.sync.set({ apiKey, model: modelSel.value });
  setStatus("Testing " + modelSel.value + "…", "");
  testBtn.disabled = true;
  try {
    const resp = await chrome.runtime.sendMessage({
      action: "rewrite",
      text: "hello there, just checking this works",
      tone: "concise",
    });
    if (resp && resp.ok) setStatus("Key works! ✓", "ok");
    else setStatus("Failed: " + (resp?.error || "unknown error"), "err");
  } catch (e) {
    setStatus("Failed: " + (e.message || e), "err");
  } finally {
    testBtn.disabled = false;
  }
});
