import { rewriteText, TONES } from "./lib/gemini.js";

// ---- Context menu setup -----------------------------------------------------

function buildMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "rewrite-parent",
      title: "Rewrite",
      contexts: ["selection"],
    });
    for (const t of TONES) {
      chrome.contextMenus.create({
        id: `rewrite:${t.id}`,
        parentId: "rewrite-parent",
        title: t.title,
        contexts: ["selection"],
      });
    }
  });
}

chrome.runtime.onInstalled.addListener(buildMenus);
chrome.runtime.onStartup.addListener(buildMenus);

// ---- Toolbar icon opens settings -------------------------------------------

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// ---- Menu click -> ask the content script to run ---------------------------

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || typeof info.menuItemId !== "string") return;
  if (!info.menuItemId.startsWith("rewrite:")) return;
  const tone = info.menuItemId.slice("rewrite:".length);
  chrome.tabs.sendMessage(tab.id, { action: "begin", tone }).catch(() => {
    // Content script not present on this page (e.g. chrome:// pages).
  });
});

// ---- API calls happen here (key + host permission live in the worker) ------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.action === "rewrite") {
    (async () => {
      try {
        const { apiKey, model } = await chrome.storage.sync.get([
          "apiKey",
          "model",
        ]);
        const text = await rewriteText(msg.text, msg.tone, apiKey, model);
        sendResponse({ ok: true, text });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    })();
    return true; // keep the message channel open for the async response
  }

  if (msg?.action === "openOptions") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }
});
