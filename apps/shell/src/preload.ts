import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("kioskShell", {
  isElectron: true,
  openRegistration: (url: string) => ipcRenderer.send("open-registration", url),
  closeRegistration: () => ipcRenderer.send("close-registration"),
  notifyActivity: () => ipcRenderer.send("kiosk-display-activity"),
});

contextBridge.exposeInMainWorld("electronAPI", {
  goBack: () => ipcRenderer.send("registration-go-back"),
  closeRegistration: () => ipcRenderer.send("close-registration"),
  hideKeyboard: () => ipcRenderer.send("keyboard-hide"),
  notifyActivity: () => ipcRenderer.send("kiosk-user-activity"),
});

contextBridge.exposeInMainWorld("keyboardAPI", {
  sendKey: (key: string) => ipcRenderer.send("keyboard-key", key),
  backspace: () => ipcRenderer.send("keyboard-backspace"),
  enter: () => ipcRenderer.send("keyboard-enter"),
  hide: () => ipcRenderer.send("keyboard-hide"),
  notifyActivity: () => ipcRenderer.send("kiosk-user-activity"),
});
