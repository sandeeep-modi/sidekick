// Bridge for the spinner overlay. It only ever listens — it has nothing to say.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  onState: (callback) => ipcRenderer.on("overlay:state", (_event, payload) => callback(payload)),
});
