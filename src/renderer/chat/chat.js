import { renderMarkdown } from "./markdown.js";

const $ = (id) => document.getElementById(id);

const els = {
  messages: $("messages"),
  emptyState: $("empty-state"),
  input: $("chat-input"),
  send: $("send-btn"),
  close: $("close-btn"),
  newBtn: $("new-btn"),
  historyBtn: $("history-btn"),
  modelName: $("model-name"),
  confirmOverlay: $("confirm-overlay"),
  confirmCancel: $("confirm-cancel"),
  confirmDiscard: $("confirm-discard"),
  confirmSave: $("confirm-save"),
  historyPanel: $("history-panel"),
  historyList: $("history-list"),
  historyEmpty: $("history-empty"),
  historyClose: $("history-close"),
};

let history = [];
let busy = false;
let confirmOnEnd = true;

let pendingAction = null;
let sessionId = 0;

let typingRow = null;

const scrollToBottom = () => {
  els.messages.scrollTop = els.messages.scrollHeight;
};

function scrollRowToTop(row) {
  els.messages.scrollTop = Math.max(0, row.offsetTop - els.messages.offsetTop);
}

const COPY_FEEDBACK_MS = 1400;

const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>';

function addCopyButton(row, text) {
  const actions = document.createElement("div");
  actions.className = "bubble-actions";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "copy-btn";
  btn.title = "Copy response";
  btn.setAttribute("aria-label", "Copy response");
  btn.innerHTML = COPY_ICON;

  let resetTimer;
  btn.addEventListener("click", async () => {
    clearTimeout(resetTimer);
    try {
      await navigator.clipboard.writeText(text);
      btn.innerHTML = CHECK_ICON;
      btn.classList.add("copied");
      btn.title = "Copied";
      resetTimer = setTimeout(() => {
        btn.innerHTML = COPY_ICON;
        btn.classList.remove("copied");
        btn.title = "Copy response";
      }, COPY_FEEDBACK_MS);
    } catch {
      btn.title = "Copy failed";
      resetTimer = setTimeout(() => (btn.title = "Copy response"), COPY_FEEDBACK_MS);
    }
  });

  actions.append(btn);
  row.append(actions);
}

function appendBubble(role, text, { error = false, scroll = "bottom" } = {}) {
  els.emptyState.hidden = true;

  const row = document.createElement("div");
  row.className = `bubble-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.classList.toggle("error", error);

  if (role === "ai" && !error) {
    bubble.classList.add("md");
    bubble.innerHTML = renderMarkdown(text); // renderMarkdown() HTML-escapes; safe for innerHTML
  } else {
    bubble.textContent = text;
  }

  row.append(bubble);
  if (role === "ai" && !error) addCopyButton(row, text);
  els.messages.append(row);
  if (scroll === "top") scrollRowToTop(row);
  else scrollToBottom();
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

function resetSession() {
  sessionId++;
  history = [];
  busy = false;

  hideTyping();
  pendingAction = null;
  els.confirmOverlay.hidden = true;
  els.historyPanel.hidden = true;
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
    result = { error: "Something went wrong. Try again." };
  }

  if (mySession !== sessionId) return; // session ended mid-flight; drop stale reply

  hideTyping();

  if (result.error) {
    const message =
      result.error === "NO_KEY"
        ? "⚠ Add your Gemini API key in Sidekick Settings first."
        : `⚠ ${result.error}`;
    appendBubble("ai", message, { error: true });
    history.pop();
  } else {
    appendBubble("ai", result.reply, { scroll: "top" });
    history.push({ role: "model", text: result.reply });
  }

  busy = false;
  setInputEnabled(true);
}

// Clear only once the window is out of sight, so the transcript doesn't
// visibly blank out for a frame on the way down.
async function endSession(action) {
  if (action === "hide") await window.api.hide().catch(() => {});
  resetSession();
}

function runPending() {
  const action = pendingAction;
  pendingAction = null;
  endSession(action);
}

function offerSave(action) {
  if (!confirmOnEnd || history.length === 0) {
    endSession(action);
    return;
  }
  pendingAction = action;
  els.confirmOverlay.hidden = false;
  els.confirmDiscard.focus();
}

function requestClose() {
  offerSave("hide");
}

function requestNew() {
  offerSave("reset");
}

function dismissConfirm() {
  els.confirmOverlay.hidden = true;
  pendingAction = null;
  els.input.focus();
}

function confirmDiscard() {
  els.confirmOverlay.hidden = true;
  runPending();
}

async function confirmSave() {
  try {
    await window.api.saveChat(history);
  } catch {
    // Best-effort: a failed save must not trap the user in the dialog.
  }
  els.confirmOverlay.hidden = true;
  runPending();
}

function formatDate(ms) {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function loadThread(record) {
  resetSession();
  history = record.history.map((turn) => ({ role: turn.role, text: turn.text }));

  for (const turn of history) {
    if (turn.role === "user") appendBubble("user", turn.text);
    else appendBubble("ai", turn.text);
  }
  els.messages.scrollTop = 0;
  els.historyPanel.hidden = true;
  setInputEnabled(true);
}

function renderHistoryList(items) {
  els.historyList.replaceChildren(els.historyEmpty);
  els.historyEmpty.hidden = items.length > 0;

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "history-item";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "history-item-main";

    const title = document.createElement("div");
    title.className = "history-item-title";
    title.textContent = item.title;

    const date = document.createElement("div");
    date.className = "history-item-date";
    date.textContent = formatDate(item.savedAt);

    open.append(title, date);
    open.addEventListener("click", async () => {
      const record = await window.api.loadChat(item.id);
      if (record) loadThread(record);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "history-item-delete";
    del.textContent = "Delete";
    del.title = "Delete this saved chat";
    del.addEventListener("click", async () => {
      await window.api.deleteChat(item.id);
      row.remove();
      if (!els.historyList.querySelector(".history-item")) els.historyEmpty.hidden = false;
    });

    row.append(open, del);
    els.historyList.append(row);
  }
}

async function openHistory() {
  let items = [];
  try {
    items = await window.api.listChats();
  } catch {
    items = [];
  }
  renderHistoryList(items);
  els.historyPanel.hidden = false;
}

function closeHistory() {
  els.historyPanel.hidden = true;
  els.input.focus();
}

els.input.addEventListener("input", autoResize);
els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

els.send.addEventListener("click", sendMessage);
els.close.addEventListener("click", requestClose);
els.newBtn.addEventListener("click", requestNew);
els.historyBtn.addEventListener("click", openHistory);
els.historyClose.addEventListener("click", closeHistory);
els.confirmCancel.addEventListener("click", dismissConfirm);
els.confirmDiscard.addEventListener("click", confirmDiscard);
els.confirmSave.addEventListener("click", confirmSave);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!els.confirmOverlay.hidden) dismissConfirm();
  else if (!els.historyPanel.hidden) closeHistory();
  else window.api.hide();
});

window.api.onRefresh(({ model, closeWarning }) => {
  els.modelName.textContent = model;
  confirmOnEnd = closeWarning;
  els.input.focus();
});

window.api.onCloseRequested(requestClose);

async function init() {
  const { model, closeWarning } = await window.api.init();
  els.modelName.textContent = model;
  confirmOnEnd = closeWarning;
  resetSession();
}

init();
