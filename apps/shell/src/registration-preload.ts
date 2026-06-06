import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("__kioskInput", {
  notifyFocus: () => ipcRenderer.send("registration-input-focus"),
});
