const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  init: () => ipcRenderer.invoke("chat:init"),
  send: (payload) => ipcRenderer.invoke("chat:send", payload),
  hide: () => ipcRenderer.invoke("chat:hide"),

  saveChat: (history) => ipcRenderer.invoke("chat:save", history),
  listChats: () => ipcRenderer.invoke("chat:list"),
  loadChat: (id) => ipcRenderer.invoke("chat:load", id),
  deleteChat: (id) => ipcRenderer.invoke("chat:delete", id),

  onRefresh: (callback) => ipcRenderer.on("chat:refresh", (_event, opts) => callback(opts)),
  onCloseRequested: (callback) => ipcRenderer.on("chat:close-requested", () => callback()),
});
