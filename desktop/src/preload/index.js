const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  load: () => ipcRenderer.invoke("settings:get"),
  save: (patch) => ipcRenderer.invoke("settings:set", patch),
  testKey: () => ipcRenderer.invoke("key:test"),
  quit: () => ipcRenderer.invoke("app:quit"),
});
