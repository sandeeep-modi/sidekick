// Quick Chat renderer. All state is in memory — nothing is ever written to disk,
// and every open starts a fresh session.

import { renderMarkdown } from "./markdown.js";

const $ = (id) => document.getElementById(id);

const els = {
  messages: $("messages"),
  emptyState: $("empty-state"),
  input: $("chat-input"),
  send: $("send-btn"),
  close: $("close-btn"),
  modelName: $("model-name"),
  confirmOverlay: $("confirm-overlay"),
  dontShowAgain: $("dont-show-again"),
  confirmCancel: $("confirm-cancel"),
  confirmEnd: $("confirm-end"),
};

let history = [];
let busy = false;
let showCloseWarning = true;

// Bumped on every reset, so a reply that lands after its session ended can be dropped.
let sessionId = 0;

let typingRow = null;

// ---- Rendering ---------------------------------------------------------------

const scrollToBottom = () => {
  els.messages.scrollTop = els.messages.scrollHeight;
};

function appendBubble(role, text, { error = false } = {}) {
  els.emptyState.hidden = true;

  const row = document.createElement("div");
  row.className = `bubble-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.classList.toggle("error", error);

  if (role === "ai" && !error) {
    // Model output: rendered as markdown, escaped inside renderMarkdown().
    bubble.classList.add("md");
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }

  row.append(bubble);
  els.messages.append(row);
  scrollToBottom();
}

function showTyping() {
  if (typingRow) return;
  els.emptyState.hidden = true;

  typingRow = document.createElement("div");
  typingRow.className = "bubble-row ai";

  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.className = "typing-dot";
    indicator.append(dot);
  }

  typingRow.append(indicator);
  els.messages.append(typingRow);
  scrollToBottom();
}

function hideTyping() {
  typingRow?.remove();
  typingRow = null;
}

function autoResize() {
  els.input.style.height = "auto";
  els.input.style.height = `${els.input.scrollHeight}px`;
}

function setInputEnabled(enabled) {
  els.input.disabled = !enabled;
  els.send.disabled = !enabled;
  if (enabled) {
    els.input.focus();
    autoResize();
  }
}

// ---- Session -----------------------------------------------------------------

function resetSession() {
  sessionId++;
  history = [];
  busy = false;

  hideTyping();
  els.confirmOverlay.hidden = true;
  els.messages.replaceChildren(els.emptyState);
  els.emptyState.hidden = false;
  els.input.value = "";
  setInputEnabled(true);
}

async function sendMessage() {
  const text = els.input.value.trim();
  if (!text || busy) return;

  busy = true;
  setInputEnabled(false);
  appendBubble("user", text);

  const priorTurns = [...history];
  history.push({ role: "user", text });

  els.input.value = "";
  autoResize();
  showTyping();

  const mySession = sessionId;

  let result;
  try {
    result = await window.api.send({ history: priorTurns, userText: text });
  } catch {
    // The invoke itself rejected (main crashed / channel gone) — surface it, don't hang.
    result = { error: "Something went wrong. Try again." };
  }

  // The session ended while this was in flight — drop the reply on the floor.
  if (mySession !== sessionId) return;

  hideTyping();

  if (result.error) {
    const message =
      result.error === "NO_KEY"
        ? "⚠ Add your Gemini API key in Sidekick Settings first."
        : `⚠ ${result.error}`;
    appendBubble("ai", message, { error: true });
    history.pop(); // drop the failed turn so a retry starts clean
  } else {
    appendBubble("ai", result.reply);
    history.push({ role: "model", text: result.reply });
  }

  busy = false;
  setInputEnabled(true);
}

// ---- Ending a session --------------------------------------------------------

/** The X button and the end-session shortcut — not the toggle, and not Escape. */
function requestClose() {
  if (!showCloseWarning || history.length === 0) {
    window.api.hide();
    return;
  }
  els.dontShowAgain.checked = false;
  els.confirmOverlay.hidden = false;
  els.confirmEnd.focus();
}

function dismissConfirm() {
  els.confirmOverlay.hidden = true;
  els.input.focus();
}

async function confirmEnd() {
  if (els.dontShowAgain.checked) {
    showCloseWarning = false;
    // Best-effort — even if persisting the preference fails, still close.
    try {
      await window.api.setCloseWarning(false);
    } catch {
      // ignore
    }
  }
  els.confirmOverlay.hidden = true;
  window.api.hide();
}

// ---- Wiring ------------------------------------------------------------------

els.input.addEventListener("input", autoResize);
els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

els.send.addEventListener("click", sendMessage);
els.close.addEventListener("click", requestClose);
els.confirmCancel.addEventListener("click", dismissConfirm);
els.confirmEnd.addEventListener("click", confirmEnd);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!els.confirmOverlay.hidden) dismissConfirm();
  else window.api.hide(); // quick hide, no confirmation
});

window.api.onReset(({ model, closeWarning }) => {
  resetSession();
  showCloseWarning = closeWarning;
  els.modelName.textContent = model;
});

window.api.onCloseRequested(requestClose);

// Created hidden at launch, so seed the UI from settings before the first "chat:reset".
async function init() {
  const { model, closeWarning } = await window.api.init();
  showCloseWarning = closeWarning;
  els.modelName.textContent = model;
  resetSession();
}

init();
