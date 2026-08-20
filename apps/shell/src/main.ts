import {
  app,
  BrowserView,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  type WebContents,
} from "electron";
import fs from "fs/promises";
import path from "path";
import {
  isRegistrationUrlAllowed,
  refreshAllowedDomains,
  startAllowedDomainsPolling,
} from "./allowed-domains";
import { captureKioskScreenshot } from "./capture-kiosk-screenshot";
import {
  injectKioskInputScript,
  KIOSK_KEYBOARD_COVER_CSS,
  KIOSK_KEYBOARD_CSS,
} from "./inject-kiosk-input";
import { noteDisplayActivity, startDisplayPowerControl } from "./display-power";

const KIOSK_URL = process.env.KIOSK_URL ?? "http://localhost:3000/kiosk";
const API_BASE = new URL(KIOSK_URL).origin;

function isTruthyEnv(v: string | undefined): boolean {
  const s = (v ?? "").toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

// Desktop window mode is opt-in via KIOSK_DESKTOP_MODE (dev:desktop). Do not tie
// this to app.isPackaged — production installs run unpackaged `electron .`.
const desktopMode = isTruthyEnv(process.env.KIOSK_DESKTOP_MODE);
const DESKTOP_WIDTH = 1080;
const DESKTOP_HEIGHT = 1920;
const CHROME_HEIGHT = 72;
const KEYBOARD_HEIGHT = 380;

function configureGpuForEmbeddedLinux() {
  if (process.platform !== "linux") return;

  // Avoid Chromium crashes when /dev/shm is small (common on embedded Linux).
  app.commandLine.appendSwitch("disable-dev-shm-usage");
}

configureGpuForEmbeddedLinux();

type KeyboardTarget = "main" | "registration";

let mainWindow: BrowserWindow | null = null;
let registrationView: BrowserView | null = null;
let chromeView: BrowserView | null = null;
let keyboardView: BrowserView | null = null;
let keyboardVisible = false;
let keyboardTarget: KeyboardTarget = "main";
let registrationOpening = false;

function destroyBrowserView(view: BrowserView | null) {
  if (!view || !mainWindow) return;
  try {
    if (!mainWindow.isDestroyed() && mainWindow.getBrowserViews().includes(view)) {
      mainWindow.removeBrowserView(view);
    }
    if (!view.webContents.isDestroyed()) {
      view.webContents.close();
    }
  } catch (err) {
    console.warn("[kiosk] Error destroying BrowserView:", err);
  }
}

function setupMainWindowCrashRecovery(win: BrowserWindow) {
  const wc = win.webContents;

  wc.on("render-process-gone", (_event, details) => {
    console.error(
      "[kiosk] Main renderer gone:",
      details.reason,
      "exitCode=",
      details.exitCode,
    );
    if (details.reason === "clean-exit") return;

    setTimeout(() => {
      if (win.isDestroyed() || wc.isDestroyed()) {
        createWindow();
        return;
      }
      void wc.reload();
    }, 500);
  });

  wc.on("unresponsive", () => {
    console.error("[kiosk] Main window unresponsive — reloading");
    if (!wc.isDestroyed()) void wc.reload();
  });
}

function setupRegistrationCrashRecovery(view: BrowserView, label: string) {
  view.webContents.on("render-process-gone", (_event, details) => {
    console.error(
      `[kiosk] ${label} renderer gone:`,
      details.reason,
      "exitCode=",
      details.exitCode,
    );
    closeRegistrationView();
  });
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
    mainWindow = null;
  }

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

  setupMainWindowCrashRecovery(mainWindow);

  if (desktopMode) {
    mainWindow.setAspectRatio(DESKTOP_WIDTH / DESKTOP_HEIGHT);
  }

  mainWindow.loadURL(KIOSK_URL);

  setupKioskInputMonitoring(mainWindow.webContents, {
    coveredByKeyboard: true,
  });
  dismissKeyboardOnNavigation(mainWindow.webContents, { includeInPage: true });

  if (!desktopMode) {
    mainWindow.webContents.on("did-finish-load", () => {
      void mainWindow?.webContents.insertCSS(
        "html, body, *, a, button, [role='button'] { cursor: none !important; }",
      );
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
      noteDisplayActivity();
      if (input.alt || input.control || input.meta) {
        event.preventDefault();
      }
    });
    mainWindow.webContents.on("input-event", (_event, inputEvent) => {
      const type = String(inputEvent.type);
      if (
        type === "mouseDown" ||
        type === "keyDown" ||
        type === "rawKeyDown" ||
        type === "mouseWheel" ||
        type === "gestureScrollBegin"
      ) {
        noteDisplayActivity();
      }
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isRegistrationUrlAllowed(url)) {
      openRegistrationView(url);
    }
    return { action: "deny" };
  });
}

function typingWebContents(): WebContents | null {
  if (keyboardTarget === "registration") {
    return registrationView?.webContents ?? null;
  }
  return mainWindow?.webContents ?? null;
}

function setupKeyboardCrashRecovery(view: BrowserView) {
  view.webContents.on("render-process-gone", (_event, details) => {
    console.error(
      "[kiosk] On-screen keyboard renderer gone:",
      details.reason,
      "exitCode=",
      details.exitCode,
    );
    hideKeyboard();
  });
}

const KEYBOARD_BACKGROUND = "#1e293b";

function raiseKeyboardView() {
  if (!mainWindow || !keyboardView) return;
  mainWindow.setTopBrowserView(keyboardView);
}

function showKeyboard(target: KeyboardTarget) {
  if (!mainWindow) return;

  keyboardTarget = target;
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
    keyboardView.setBackgroundColor(KEYBOARD_BACKGROUND);
    setupKeyboardCrashRecovery(keyboardView);
    mainWindow.addBrowserView(keyboardView);

    const keyboardPath = path.join(__dirname, "keyboard.html");
    keyboardView.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        console.error(
          "[kiosk] keyboard.html failed to load:",
          errorCode,
          errorDescription,
          validatedURL,
          `(expected ${keyboardPath})`,
        );
      },
    );
    void keyboardView.webContents.loadFile(keyboardPath);
  }

  layoutKioskViews();
  raiseKeyboardView();
  setKeyboardOpenClass(true);
}

function hideKeyboard() {
  if (!keyboardVisible && !keyboardView) return;
  const previousTarget = typingWebContents();
  keyboardVisible = false;
  destroyBrowserView(keyboardView);
  keyboardView = null;
  layoutKioskViews();
  setKeyboardOpenClass(false);
  endEditingIn(previousTarget);
}

function executeInWebContents(webContents: WebContents | null, script: string) {
  if (!webContents || webContents.isDestroyed()) return;
  void webContents.executeJavaScript(script, true);
}

function setKeyboardOpenClass(open: boolean) {
  const mainScript = `document.documentElement.classList.toggle("kiosk-keyboard-open", ${
    open && keyboardTarget === "main"
  })`;
  const overlayScript = `document.documentElement.classList.toggle("kiosk-keyboard-open", ${
    open && keyboardTarget === "registration"
  })`;
  executeInWebContents(mainWindow?.webContents ?? null, mainScript);
  executeInWebContents(registrationView?.webContents ?? null, overlayScript);
}

function endEditingIn(webContents: WebContents | null) {
  executeInWebContents(
    webContents,
    "window.__kioskEndEditing && window.__kioskEndEditing()",
  );
}

function sendToFocusedTyping(method: string, arg?: string) {
  const script = arg
    ? `window.__kioskTyping && window.__kioskTyping.${method}(${JSON.stringify(arg)})`
    : `window.__kioskTyping && window.__kioskTyping.${method}()`;
  executeInWebContents(typingWebContents(), script);
}

function resolveKeyboardTarget(sender: WebContents): KeyboardTarget {
  if (registrationView && sender === registrationView.webContents) {
    return "registration";
  }
  return "main";
}

const KIOSK_USER_ACTIVITY_EVENT = "kiosk-user-activity";

function notifyMainWindowUserActivity() {
  executeInWebContents(
    mainWindow?.webContents ?? null,
    `window.dispatchEvent(new Event(${JSON.stringify(KIOSK_USER_ACTIVITY_EVENT)}))`,
  );
}

function setupKioskInputMonitoring(
  webContents: WebContents,
  options?: { coveredByKeyboard?: boolean },
) {
  const inject = () => {
    void webContents.insertCSS(KIOSK_KEYBOARD_CSS);
    if (options?.coveredByKeyboard) {
      void webContents.insertCSS(KIOSK_KEYBOARD_COVER_CSS);
    }
    void injectKioskInputScript(webContents);
  };

  webContents.on("did-finish-load", inject);
  webContents.on("dom-ready", inject);
}

function dismissKeyboardOnNavigation(
  webContents: WebContents,
  options?: { includeInPage?: boolean },
) {
  webContents.on("did-navigate", () => hideKeyboard());
  if (options?.includeInPage) {
    webContents.on("did-navigate-in-page", () => hideKeyboard());
  }
}

function openRegistrationView(url: string) {
  if (!mainWindow || registrationOpening) return;
  if (!isRegistrationUrlAllowed(url)) {
    console.warn("Blocked registration URL:", url);
    return;
  }

  registrationOpening = true;
  try {
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

    setupRegistrationCrashRecovery(chromeView, "Registration chrome");
    setupRegistrationCrashRecovery(registrationView, "Registration page");

    mainWindow.addBrowserView(chromeView);
    mainWindow.addBrowserView(registrationView);
    setupKioskInputMonitoring(registrationView.webContents);
    dismissKeyboardOnNavigation(registrationView.webContents);
    layoutKioskViews();

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
  } finally {
    registrationOpening = false;
  }
}

function closeRegistrationView() {
  hideKeyboard();

  destroyBrowserView(registrationView);
  registrationView = null;

  destroyBrowserView(chromeView);
  chromeView = null;
}

function layoutKioskViews() {
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

function getRepoRoot(): string {
  if (!app.isPackaged) {
    return path.resolve(app.getAppPath(), "..", "..");
  }
  return process.cwd();
}

function screenshotSlugFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    if (pathname === "/kiosk" || pathname === "/kiosk/") {
      return "kiosk-home";
    }
    const match = pathname.match(/^\/kiosk\/events\/([^/]+)\/?$/);
    if (match) {
      return `kiosk-events-${match[1]}`;
    }
    const trimmed = pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
    return trimmed || "kiosk";
  } catch {
    return "kiosk";
  }
}

function screenshotTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

async function captureCurrentKioskPage(): Promise<void> {
  if (!mainWindow) {
    console.warn("[screenshot] No main window available.");
    return;
  }

  if (registrationView) {
    console.warn(
      "[screenshot] Skipped — close the registration overlay before capturing.",
    );
    return;
  }

  const url = mainWindow.webContents.getURL();
  let pathname = "";
  try {
    pathname = new URL(url).pathname;
  } catch {
    console.warn("[screenshot] Skipped — invalid current URL.");
    return;
  }

  if (!pathname.startsWith("/kiosk")) {
    console.warn(
      "[screenshot] Skipped — navigate to a /kiosk page before capturing.",
    );
    return;
  }

  const screenshotsDir = path.join(getRepoRoot(), "screenshots");
  await fs.mkdir(screenshotsDir, { recursive: true });

  const filename = `${screenshotSlugFromUrl(url)}-${screenshotTimestamp()}.png`;
  const outputPath = path.join(screenshotsDir, filename);

  try {
    await captureKioskScreenshot(url, outputPath, mainWindow.webContents.session);
    console.log(`[screenshot] Saved 1080x1920 PNG: ${outputPath}`);
  } catch (err) {
    console.error("[screenshot] Capture failed:", err);
  }
}

function registerShortcuts() {
  if (desktopMode) {
    globalShortcut.register("CommandOrControl+Shift+S", () => {
      void captureCurrentKioskPage();
    });
    return;
  }

  const block = () => false;
  globalShortcut.register("Alt+Tab", block);
  globalShortcut.register("CommandOrControl+W", block);
  globalShortcut.register("F11", block);
  globalShortcut.register("CommandOrControl+Shift+I", block);
}

app.whenReady().then(async () => {
  console.log(
    `[kiosk] Starting shell platform=${process.platform} arch=${process.arch} desktop=${desktopMode}`,
  );

  await refreshAllowedDomains(API_BASE);
  startAllowedDomainsPolling(API_BASE);
  if (!desktopMode) {
    startDisplayPowerControl(API_BASE);
  }
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

  ipcMain.on("kiosk-input-focus", (event) => {
    showKeyboard(resolveKeyboardTarget(event.sender));
  });

  ipcMain.on("kiosk-user-activity", () => {
    noteDisplayActivity();
    notifyMainWindowUserActivity();
  });

  ipcMain.on("kiosk-display-activity", () => {
    noteDisplayActivity();
  });

  ipcMain.on("keyboard-key", (_event, key: string) => {
    noteDisplayActivity();
    notifyMainWindowUserActivity();
    sendToFocusedTyping("insertText", key);
  });

  ipcMain.on("keyboard-backspace", () => {
    noteDisplayActivity();
    notifyMainWindowUserActivity();
    sendToFocusedTyping("backspace");
  });

  ipcMain.on("keyboard-enter", () => {
    noteDisplayActivity();
    notifyMainWindowUserActivity();
    sendToFocusedTyping("enter");
  });

  ipcMain.on("keyboard-hide", () => {
    hideKeyboard();
  });

  mainWindow?.on("resize", layoutKioskViews);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

process.on("SIGTERM", () => app.quit());

app.on("child-process-gone", (_event, details) => {
  console.error(
    "[kiosk] Child process gone:",
    details.type,
    details.reason,
    "exitCode=",
    details.exitCode,
  );
});
