// Bridge for the Quick Chat window — the narrowest surface: no settings channel and
// no way to reach the API key, since it renders model output as HTML.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  init: () => ipcRenderer.invoke("chat:init"),
  send: (payload) => ipcRenderer.invoke("chat:send", payload),
  hide: () => ipcRenderer.invoke("chat:hide"),
  setCloseWarning: (enabled) => ipcRenderer.invoke("chat:setCloseWarning", enabled),

  // Main asks the renderer to start a fresh session / to end one.
  onReset: (callback) => ipcRenderer.on("chat:reset", (_event, opts) => callback(opts)),
  onCloseRequested: (callback) => ipcRenderer.on("chat:close-requested", () => callback()),
});
