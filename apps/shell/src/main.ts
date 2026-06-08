import {
  app,
  BrowserView,
  BrowserWindow,
  globalShortcut,
  ipcMain,
} from "electron";
import path from "path";
import {
  isRegistrationUrlAllowed,
  refreshAllowedDomains,
  startAllowedDomainsPolling,
} from "./allowed-domains";
import { injectRegistrationInputScript } from "./inject-registration-input";

const KIOSK_URL = process.env.KIOSK_URL ?? "http://localhost:3000/kiosk";
const API_BASE = new URL(KIOSK_URL).origin;

function isTruthyEnv(v: string | undefined): boolean {
  const s = (v ?? "").toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

const desktopMode =
  isTruthyEnv(process.env.KIOSK_DESKTOP_MODE) || !app.isPackaged;
const DESKTOP_WIDTH = 1080;
const DESKTOP_HEIGHT = 1920;
const CHROME_HEIGHT = 72;
const KEYBOARD_HEIGHT = 380;

let mainWindow: BrowserWindow | null = null;
let registrationView: BrowserView | null = null;
let chromeView: BrowserView | null = null;
let keyboardView: BrowserView | null = null;
let keyboardVisible = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: desktopMode ? DESKTOP_WIDTH : undefined,
    height: desktopMode ? DESKTOP_HEIGHT : undefined,
    kiosk: !desktopMode,
    fullscreen: !desktopMode,
    frame: desktopMode,
    autoHideMenuBar: true,
    alwaysOnTop: !desktopMode,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (desktopMode) {
    mainWindow.setAspectRatio(DESKTOP_WIDTH / DESKTOP_HEIGHT);
  }

  mainWindow.loadURL(KIOSK_URL);

  if (!desktopMode) {
    mainWindow.webContents.on("did-finish-load", () => {
      void mainWindow?.webContents.insertCSS(
        "html, body, *, a, button, [role='button'] { cursor: none !important; }",
      );
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isRegistrationUrlAllowed(url)) {
      openRegistrationView(url);
    }
    return { action: "deny" };
  });

  if (!desktopMode) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.alt || input.control || input.meta) {
        event.preventDefault();
      }
    });
  }
}

function showKeyboard() {
  if (!mainWindow || !registrationView || keyboardVisible) return;

  keyboardVisible = true;

  if (!keyboardView) {
    keyboardView = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    mainWindow.addBrowserView(keyboardView);
    keyboardView.webContents.loadFile(
      path.join(__dirname, "registration-keyboard.html"),
    );
  }

  layoutRegistrationViews();
}

function hideKeyboard() {
  if (!keyboardVisible) return;
  keyboardVisible = false;
  layoutRegistrationViews();
}

function sendToRegistrationTyping(method: string, arg?: string) {
  if (!registrationView) return;
  const script = arg
    ? `window.__kioskTyping && window.__kioskTyping.${method}(${JSON.stringify(arg)})`
    : `window.__kioskTyping && window.__kioskTyping.${method}()`;
  void registrationView.webContents.executeJavaScript(script, true);
}

function setupRegistrationInputMonitoring(view: BrowserView) {
  const inject = () => {
    void injectRegistrationInputScript(view.webContents);
  };

  view.webContents.on("did-finish-load", inject);
  view.webContents.on("dom-ready", inject);
}

function openRegistrationView(url: string) {
  if (!mainWindow) return;
  if (!isRegistrationUrlAllowed(url)) {
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
      preload: path.join(__dirname, "registration-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.addBrowserView(chromeView);
  mainWindow.addBrowserView(registrationView);
  setupRegistrationInputMonitoring(registrationView);
  layoutRegistrationViews();

  chromeView.webContents.loadFile(path.join(__dirname, "registration-chrome.html"));

  registrationView.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    if (isRegistrationUrlAllowed(newUrl)) {
      registrationView?.webContents.loadURL(newUrl);
    }
    return { action: "deny" };
  });

  registrationView.webContents.on("will-navigate", (event, navigationUrl) => {
    if (!isRegistrationUrlAllowed(navigationUrl)) {
      event.preventDefault();
    }
  });

  registrationView.webContents.loadURL(url);
}

function closeRegistrationView() {
  hideKeyboard();

  if (keyboardView && mainWindow) {
    mainWindow.removeBrowserView(keyboardView);
    keyboardView.webContents.close();
    keyboardView = null;
  }

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
  const keyboardHeight = keyboardVisible ? KEYBOARD_HEIGHT : 0;

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
      height: bounds.height - CHROME_HEIGHT - keyboardHeight,
    });
    registrationView.setAutoResize({ width: true, height: true });
  }

  if (keyboardView) {
    if (keyboardVisible) {
      keyboardView.setBounds({
        x: 0,
        y: bounds.height - keyboardHeight,
        width: bounds.width,
        height: keyboardHeight,
      });
      keyboardView.setAutoResize({ width: true, height: false });
    } else {
      keyboardView.setBounds({
        x: 0,
        y: bounds.height,
        width: bounds.width,
        height: 0,
      });
    }
  }
}

function registerShortcuts() {
  if (desktopMode) return;
  const block = () => false;
  globalShortcut.register("Alt+Tab", block);
  globalShortcut.register("CommandOrControl+W", block);
  globalShortcut.register("F11", block);
  globalShortcut.register("CommandOrControl+Shift+I", block);
}

app.whenReady().then(async () => {
  await refreshAllowedDomains(API_BASE);
  startAllowedDomainsPolling(API_BASE);
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

  ipcMain.on("registration-input-focus", () => {
    showKeyboard();
  });

  ipcMain.on("keyboard-key", (_event, key: string) => {
    sendToRegistrationTyping("insertText", key);
  });

  ipcMain.on("keyboard-backspace", () => {
    sendToRegistrationTyping("backspace");
  });

  ipcMain.on("keyboard-enter", () => {
    sendToRegistrationTyping("enter");
  });

  ipcMain.on("keyboard-hide", () => {
    hideKeyboard();
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
