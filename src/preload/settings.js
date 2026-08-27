const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  load: () => ipcRenderer.invoke("settings:get"),
  save: (patch) => ipcRenderer.invoke("settings:set", patch),
  getApiKey: () => ipcRenderer.invoke("settings:getApiKey"),
  testKey: () => ipcRenderer.invoke("settings:testKey"),
  quit: () => ipcRenderer.invoke("app:quit"),
  openKeyPage: () => ipcRenderer.invoke("app:openExternal", "https://aistudio.google.com/apikey"),
  suspendShortcuts: () => ipcRenderer.invoke("shortcuts:suspend"),
  resumeShortcuts: () => ipcRenderer.invoke("shortcuts:resume"),
  onModelsUpdated: (callback) =>
    ipcRenderer.on("models:updated", (_event, models) => callback(models)),
});
