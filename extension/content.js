(() => {
  if (window.__rewordLoaded) return;
  window.__rewordLoaded = true;

  const TONE_LABELS = {
    professional: "Professional",
    polite: "Polite",
    concise: "Concise",
    casual: "Casual / Team",
  };

  let lastSelection = null; // captured selection info for Replace
  let host = null; // shadow host element for the popup

  // ---- Selection capture ----------------------------------------------------

  function isEditableNode(node) {
    let el = node && node.nodeType === 3 ? node.parentElement : node;
    while (el) {
      if (el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  function captureSelection() {
    const ae = document.activeElement;
    if (
      ae &&
      (ae.tagName === "TEXTAREA" ||
        (ae.tagName === "INPUT" &&
          /^(text|search|email|url|tel|)$/.test(ae.type)))
    ) {
      const s = ae.selectionStart;
      const e = ae.selectionEnd;
      if (s != null && e != null && s !== e) {
        return {
          kind: "input",
          el: ae,
          start: s,
          end: e,
          text: ae.value.slice(s, e),
          editable: true,
        };
      }
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      const range = sel.getRangeAt(0).cloneRange();
      return {
        kind: "range",
        range,
        text: sel.toString(),
        editable: isEditableNode(range.commonAncestorContainer),
      };
    }
    return null;
  }

  function selectionRect(info) {
    let r = null;
    if (info.kind === "input") r = info.el.getBoundingClientRect();
    else r = info.range.getBoundingClientRect();
    if (r && (r.width || r.height)) return r;
    return { left: 20, top: 20, bottom: 40, width: 180, height: 20 };
  }

  function replaceSelection(info, newText) {
    try {
      if (info.kind === "input") {
        const el = info.el;
        el.focus();
        const v = el.value;
        el.value = v.slice(0, info.start) + newText + v.slice(info.end);
        const caret = info.start + newText.length;
        el.selectionStart = el.selectionEnd = caret;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(info.range);
      if (document.execCommand("insertText", false, newText)) return true;
      // Fallback if execCommand is unavailable.
      info.range.deleteContents();
      info.range.insertNode(document.createTextNode(newText));
      return true;
    } catch {
      return false;
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  // ---- Popup (isolated in a shadow root) ------------------------------------

  const STYLE = `
    :host { all: initial; }
    .card {
      position: fixed; z-index: 2147483647; max-width: 380px; min-width: 280px;
      background: #1e1e2e; color: #e6e6ef; border: 1px solid #33334d;
      border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.35);
      font: 13px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif;
      padding: 12px; box-sizing: border-box;
    }
    .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
    .tone { font-size:11px; letter-spacing:.04em; text-transform:uppercase; color:#a9a9c9; }
    .x { cursor:pointer; color:#8a8aa8; border:none; background:none; font-size:16px; line-height:1; padding:0 2px; }
    .x:hover { color:#e6e6ef; }
    .body { white-space:pre-wrap; word-break:break-word; max-height:240px; overflow:auto;
      background:#26263a; border-radius:6px; padding:9px 10px; margin-bottom:10px; }
    .row { display:flex; gap:8px; flex-wrap:wrap; }
    button.act {
      flex:1; min-width:80px; cursor:pointer; border:none; border-radius:6px;
      padding:7px 10px; font-size:12px; font-weight:600; color:#fff;
    }
    .primary { background:#14a05a; }
    .primary:hover { background:#17b866; }
    .ghost { background:#3a3a55; }
    .ghost:hover { background:#464666; }
    .muted { color:#a9a9c9; font-size:12px; }
    .err { color:#ff8b8b; }
    .spin { display:inline-block; width:13px; height:13px; border:2px solid #555;
      border-top-color:#72f69b; border-radius:50%; animation:sp .7s linear infinite; vertical-align:-2px; margin-right:6px; }
    @keyframes sp { to { transform:rotate(360deg); } }
    .link { color:#72f69b; cursor:pointer; text-decoration:underline; }
  `;

  function ensureHost(rect) {
    closePopup();
    host = document.createElement("div");
    host.setAttribute("data-reword", "");
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    const card = document.createElement("div");
    card.className = "card";
    shadow.append(style, card);
    document.documentElement.appendChild(host);

    // Position under the selection, clamped to the viewport.
    const cardW = 380;
    let left = Math.max(8, Math.min(rect.left, window.innerWidth - cardW - 8));
    let top = rect.bottom + 8;
    if (top > window.innerHeight - 120) top = Math.max(8, rect.top - 12);
    card.style.left = left + "px";
    card.style.top = top + "px";

    setTimeout(() => document.addEventListener("mousedown", onOutside, true), 0);
    document.addEventListener("keydown", onEsc, true);
    return card;
  }

  function onOutside(e) {
    if (host && !e.composedPath().includes(host)) closePopup();
  }
  function onEsc(e) {
    if (e.key === "Escape") closePopup();
  }
  function closePopup() {
    document.removeEventListener("mousedown", onOutside, true);
    document.removeEventListener("keydown", onEsc, true);
    if (host) host.remove();
    host = null;
  }
  function card() {
    return host && host.shadowRoot.querySelector(".card");
  }

  function header(toneLabel) {
    return `<div class="head"><span class="tone">${toneLabel}</span><button class="x" data-close>×</button></div>`;
  }

  function renderLoading(tone) {
    const c = card();
    if (!c) return;
    c.innerHTML =
      header(TONE_LABELS[tone] || "Rewrite") +
      `<div class="muted"><span class="spin"></span>Rewriting…</div>`;
    wireClose();
  }

  function renderResult(text, editable, tone) {
    const c = card();
    if (!c) return;
    const replaceBtn = editable
      ? `<button class="act primary" data-replace>Replace</button>`
      : "";
    c.innerHTML =
      header(TONE_LABELS[tone] || "Rewrite") +
      `<div class="body" data-out></div>` +
      `<div class="row">${replaceBtn}` +
      `<button class="act ghost" data-copy>Copy</button>` +
      `<button class="act ghost" data-regen>Regenerate</button></div>`;
    c.querySelector("[data-out]").textContent = text;
    wireClose();

    const rep = c.querySelector("[data-replace]");
    if (rep)
      rep.addEventListener("click", () => {
        const ok = replaceSelection(lastSelection, text);
        closePopup();
        if (!ok) alert("Reword: couldn't replace text here — use Copy instead.");
      });

    c.querySelector("[data-copy]").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const ok = await copyText(text);
      btn.textContent = ok ? "Copied ✓" : "Copy failed";
      setTimeout(() => (btn.textContent = "Copy"), 1200);
    });

    c.querySelector("[data-regen]").addEventListener("click", () =>
      runRewrite(tone)
    );
  }

  function renderError(message, isNoKey) {
    const c = card();
    if (!c) return;
    c.innerHTML =
      header("Rewrite") +
      `<div class="err" data-msg></div>` +
      (isNoKey
        ? `<div style="margin-top:8px"><span class="link" data-open>Open settings to add your API key →</span></div>`
        : "");
    c.querySelector("[data-msg]").textContent = message;
    wireClose();
    const open = c.querySelector("[data-open]");
    if (open)
      open.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "openOptions" });
        closePopup();
      });
  }

  function wireClose() {
    const c = card();
    const x = c && c.querySelector("[data-close]");
    if (x) x.addEventListener("click", closePopup);
  }

  // ---- Orchestration --------------------------------------------------------

  async function runRewrite(tone) {
    if (!lastSelection) return;
    renderLoading(tone);
    let resp;
    try {
      resp = await chrome.runtime.sendMessage({
        action: "rewrite",
        text: lastSelection.text,
        tone,
      });
    } catch (e) {
      renderError("Extension was reloaded — refresh the page and try again.");
      return;
    }
    if (!resp) return renderError("No response from the extension.");
    if (!resp.ok) {
      if (resp.error === "NO_KEY")
        return renderError("No API key set yet.", true);
      return renderError(resp.error || "Something went wrong.");
    }
    renderResult(resp.text, lastSelection.editable, tone);
  }

  function start(tone) {
    const info = captureSelection();
    if (!info || !info.text.trim()) return;
    lastSelection = info;
    ensureHost(selectionRect(info));
    runRewrite(tone);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === "begin") start(msg.tone);
  });
})();
