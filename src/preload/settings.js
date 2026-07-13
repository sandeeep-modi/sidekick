// Bridge for the settings window. This is the only renderer that can read or
// write the API key.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  load: () => ipcRenderer.invoke("settings:get"),
  save: (patch) => ipcRenderer.invoke("settings:set", patch),
  getApiKey: () => ipcRenderer.invoke("settings:getApiKey"),
  testKey: () => ipcRenderer.invoke("settings:testKey"),
  quit: () => ipcRenderer.invoke("app:quit"),
  // Global shortcuts are muted while the user records a new one, so the combo
  // they press is captured instead of triggering the existing binding.
  suspendShortcuts: () => ipcRenderer.invoke("shortcuts:suspend"),
  resumeShortcuts: () => ipcRenderer.invoke("shortcuts:resume"),
});
