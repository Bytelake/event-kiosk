import {
  app,
  BrowserView,
  BrowserWindow,
  globalShortcut,
  ipcMain,
} from "electron";
import path from "path";
import { isAllowedRegistrationUrl } from "./domain-whitelist";

const KIOSK_URL = process.env.KIOSK_URL ?? "http://localhost:3000/kiosk";
const isDev = !app.isPackaged;
const CHROME_HEIGHT = 72;

let mainWindow: BrowserWindow | null = null;
let registrationView: BrowserView | null = null;
let chromeView: BrowserView | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    kiosk: !isDev,
    fullscreen: !isDev,
    frame: isDev,
    autoHideMenuBar: true,
    alwaysOnTop: !isDev,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(KIOSK_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedRegistrationUrl(url)) {
      openRegistrationView(url);
    }
    return { action: "deny" };
  });

  if (!isDev) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.alt || input.control || input.meta) {
        event.preventDefault();
      }
    });
  }
}

function openRegistrationView(url: string) {
  if (!mainWindow) return;
  if (!isAllowedRegistrationUrl(url)) {
    console.warn("Blocked registration URL:", url);
    return;
  }

  closeRegistrationView();

  chromeView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  registrationView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.addBrowserView(chromeView);
  mainWindow.addBrowserView(registrationView);
  layoutRegistrationViews();

  chromeView.webContents.loadFile(path.join(__dirname, "registration-chrome.html"));

  registrationView.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    if (isAllowedRegistrationUrl(newUrl)) {
      registrationView?.webContents.loadURL(newUrl);
    }
    return { action: "deny" };
  });

  registrationView.webContents.on("will-navigate", (event, navigationUrl) => {
    if (!isAllowedRegistrationUrl(navigationUrl)) {
      event.preventDefault();
    }
  });

  registrationView.webContents.loadURL(url);
}

function closeRegistrationView() {
  if (!mainWindow) return;
  if (registrationView) {
    mainWindow.removeBrowserView(registrationView);
    registrationView.webContents.close();
    registrationView = null;
  }
  if (chromeView) {
    mainWindow.removeBrowserView(chromeView);
    chromeView.webContents.close();
    chromeView = null;
  }
}

function layoutRegistrationViews() {
  if (!mainWindow) return;
  const bounds = mainWindow.getContentBounds();

  if (chromeView) {
    chromeView.setBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: CHROME_HEIGHT,
    });
    chromeView.setAutoResize({ width: true, height: false });
  }

  if (registrationView) {
    registrationView.setBounds({
      x: 0,
      y: CHROME_HEIGHT,
      width: bounds.width,
      height: bounds.height - CHROME_HEIGHT,
    });
    registrationView.setAutoResize({ width: true, height: true });
  }
}

function registerShortcuts() {
  if (isDev) return;
  const block = () => false;
  globalShortcut.register("Alt+Tab", block);
  globalShortcut.register("CommandOrControl+W", block);
  globalShortcut.register("F11", block);
  globalShortcut.register("CommandOrControl+Shift+I", block);
}

app.whenReady().then(() => {
  createWindow();
  registerShortcuts();

  ipcMain.on("open-registration", (_event, url: string) => {
    openRegistrationView(url);
  });

  ipcMain.on("close-registration", () => {
    closeRegistrationView();
  });

  ipcMain.on("registration-go-back", () => {
    if (registrationView?.webContents.canGoBack()) {
      registrationView.webContents.goBack();
    } else {
      closeRegistrationView();
    }
  });

  mainWindow?.on("resize", layoutRegistrationViews);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

process.on("SIGTERM", () => app.quit());
