// Bridge for the settings window — the only renderer that can read or write the API key.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  load: () => ipcRenderer.invoke("settings:get"),
  save: (patch) => ipcRenderer.invoke("settings:set", patch),
  getApiKey: () => ipcRenderer.invoke("settings:getApiKey"),
  testKey: () => ipcRenderer.invoke("settings:testKey"),
  quit: () => ipcRenderer.invoke("app:quit"),
  // Muted while recording a new shortcut, so the combo is captured, not triggered.
  suspendShortcuts: () => ipcRenderer.invoke("shortcuts:suspend"),
  resumeShortcuts: () => ipcRenderer.invoke("shortcuts:resume"),
});
