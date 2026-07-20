const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  onState: (callback) => ipcRenderer.on("overlay:state", (_event, payload) => callback(payload)),
});
