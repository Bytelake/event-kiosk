import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("__kioskInput", {
  notifyFocus: () => ipcRenderer.send("registration-input-focus"),
  notifyDismiss: () => ipcRenderer.send("keyboard-hide"),
  notifyActivity: () => ipcRenderer.send("kiosk-user-activity"),
});
