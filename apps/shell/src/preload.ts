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
