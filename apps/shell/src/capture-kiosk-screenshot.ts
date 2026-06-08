import { BrowserWindow, type Session } from "electron";
import fs from "fs/promises";

const CAPTURE_WIDTH = 1080;
const CAPTURE_HEIGHT = 1920;
const LOAD_TIMEOUT_MS = 30_000;

function loadPage(win: BrowserWindow, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Screenshot capture timed out waiting for page load"));
    }, LOAD_TIMEOUT_MS);

    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(message));
    };

    win.webContents.once("did-finish-load", done);
    win.webContents.once(
      "did-fail-load",
      (_event, _code, description, _validatedURL, isMainFrame) => {
        if (!isMainFrame) return;
        fail(`Screenshot capture failed to load page: ${description}`);
      },
    );

    win.loadURL(url).then(done).catch((err: Error) => {
      fail(err.message);
    });
  });
}

async function waitForRenderReady(win: BrowserWindow): Promise<void> {
  await win.webContents.executeJavaScript(
    `
    (async () => {
      const deadline = Date.now() + 20000;

      const kioskApiDone = () => {
        const entries = performance.getEntriesByType("resource");
        const eventsDone = entries.some(
          (entry) => entry.name.includes("/api/events") && entry.responseEnd > 0,
        );
        const settingsDone = entries.some(
          (entry) => entry.name.includes("/api/settings") && entry.responseEnd > 0,
        );
        const isEventDetail = /^\\/kiosk\\/events\\/[^/]+/.test(
          window.location.pathname,
        );
        return isEventDetail ? eventsDone : eventsDone && settingsDone;
      };

      const isReady = () => {
        const root = document.querySelector(".kiosk-root");
        if (!root) return false;
        if (document.body.innerText.includes("Loading event...")) return false;
        return kioskApiDone();
      };

      while (!isReady() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const images = [...document.querySelectorAll("img")];
      await Promise.all(
        images.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            }),
        ),
      );

      await new Promise((resolve) => setTimeout(resolve, 500));
    })()
  `,
    true,
  );
}

export async function captureKioskScreenshot(
  url: string,
  outputPath: string,
  session?: Session,
): Promise<void> {
  const win = new BrowserWindow({
    width: CAPTURE_WIDTH,
    height: CAPTURE_HEIGHT,
    show: false,
    frame: false,
    useContentSize: true,
    webPreferences: {
      session,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    await loadPage(win, url);
    await waitForRenderReady(win);

    let image = await win.webContents.capturePage(
      { x: 0, y: 0, width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
      { stayHidden: true },
    );

    const { width, height } = image.getSize();
    if (width !== CAPTURE_WIDTH || height !== CAPTURE_HEIGHT) {
      image = image.resize({
        width: CAPTURE_WIDTH,
        height: CAPTURE_HEIGHT,
        quality: "best",
      });
    }

    await fs.writeFile(outputPath, image.toPNG());
  } finally {
    win.close();
  }
}
