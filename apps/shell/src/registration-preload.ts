import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("__kioskInput", {
  notifyFocus: () => ipcRenderer.send("kiosk-input-focus"),
  notifyDismiss: () => ipcRenderer.send("keyboard-hide"),
  notifyActivity: () => ipcRenderer.send("kiosk-user-activity"),
});
