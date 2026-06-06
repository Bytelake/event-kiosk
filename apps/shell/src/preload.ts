import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("kioskShell", {
  isElectron: true,
  openRegistration: (url: string) => ipcRenderer.send("open-registration", url),
  closeRegistration: () => ipcRenderer.send("close-registration"),
});

contextBridge.exposeInMainWorld("electronAPI", {
  goBack: () => ipcRenderer.send("registration-go-back"),
  closeRegistration: () => ipcRenderer.send("close-registration"),
});

contextBridge.exposeInMainWorld("keyboardAPI", {
  sendKey: (key: string) => ipcRenderer.send("keyboard-key", key),
  backspace: () => ipcRenderer.send("keyboard-backspace"),
  enter: () => ipcRenderer.send("keyboard-enter"),
  hide: () => ipcRenderer.send("keyboard-hide"),
});
