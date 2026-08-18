import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const SETTINGS_POLL_MS = 5_000;
const APPLY_INTERVAL_MS = 1_000;
const APPLY_TIMEOUT_MS = 8_000;

export interface DisplayPowerSettings {
  kioskDisplayEnabled: boolean;
  kioskDisplayScheduleEnabled: boolean;
  kioskDisplayOnTime: string;
  kioskDisplayOffTime: string;
  kioskDisplayIdleOffSeconds: number;
}

const defaults: DisplayPowerSettings = {
  kioskDisplayEnabled: true,
  kioskDisplayScheduleEnabled: false,
  kioskDisplayOnTime: "07:00",
  kioskDisplayOffTime: "22:00",
  kioskDisplayIdleOffSeconds: 0,
};

let settings: DisplayPowerSettings = { ...defaults };
let lastActivityAt = Date.now();
let appliedOn: boolean | null = null;
let applying = false;

function parseHhMm(value: string): number | null {
  const match = HH_MM.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isInDisplayHours(onTime: string, offTime: string, now = new Date()): boolean {
  const on = parseHhMm(onTime);
  const off = parseHhMm(offTime);
  if (on === null || off === null) return true;
  if (on === off) return true;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (on < off) return minutes >= on && minutes < off;
  return minutes >= on || minutes < off;
}

function desiredDisplayOn(now = new Date()): boolean {
  if (!settings.kioskDisplayEnabled) return false;
  if (
    settings.kioskDisplayScheduleEnabled &&
    !isInDisplayHours(settings.kioskDisplayOnTime, settings.kioskDisplayOffTime, now)
  ) {
    return false;
  }
  if (
    settings.kioskDisplayIdleOffSeconds > 0 &&
    Date.now() - lastActivityAt >= settings.kioskDisplayIdleOffSeconds * 1000
  ) {
    return false;
  }
  return true;
}

function displayPowerScriptPath(): string {
  return path.join(process.env.KIOSK_ROOT || "/opt/kiosk", "bin", "set-display-power.sh");
}

async function applyDisplayPower(wantOn: boolean): Promise<void> {
  const script = displayPowerScriptPath();
  try {
    await fs.access(script);
  } catch {
    return;
  }

  await execFileAsync(script, [wantOn ? "on" : "off"], {
    timeout: APPLY_TIMEOUT_MS,
    env: process.env,
  });
}

export async function syncDisplayPower(): Promise<void> {
  if (applying) return;
  const wantOn = desiredDisplayOn();
  if (appliedOn === wantOn) return;

  applying = true;
  try {
    await applyDisplayPower(wantOn);
    appliedOn = wantOn;
    console.log(`[kiosk] Display power ${wantOn ? "on" : "off"}`);
  } catch (err) {
    console.warn("[kiosk] Failed to set display power:", err);
  } finally {
    applying = false;
  }
}

export function noteDisplayActivity(): void {
  lastActivityAt = Date.now();
  if (appliedOn === false) {
    void syncDisplayPower();
  }
}

function parseSettings(data: Partial<DisplayPowerSettings>): DisplayPowerSettings {
  return {
    kioskDisplayEnabled:
      typeof data.kioskDisplayEnabled === "boolean"
        ? data.kioskDisplayEnabled
        : defaults.kioskDisplayEnabled,
    kioskDisplayScheduleEnabled:
      typeof data.kioskDisplayScheduleEnabled === "boolean"
        ? data.kioskDisplayScheduleEnabled
        : defaults.kioskDisplayScheduleEnabled,
    kioskDisplayOnTime:
      typeof data.kioskDisplayOnTime === "string" && parseHhMm(data.kioskDisplayOnTime) !== null
        ? data.kioskDisplayOnTime
        : defaults.kioskDisplayOnTime,
    kioskDisplayOffTime:
      typeof data.kioskDisplayOffTime === "string" && parseHhMm(data.kioskDisplayOffTime) !== null
        ? data.kioskDisplayOffTime
        : defaults.kioskDisplayOffTime,
    kioskDisplayIdleOffSeconds:
      typeof data.kioskDisplayIdleOffSeconds === "number" &&
      Number.isFinite(data.kioskDisplayIdleOffSeconds)
        ? Math.max(0, Math.floor(data.kioskDisplayIdleOffSeconds))
        : defaults.kioskDisplayIdleOffSeconds,
  };
}

function settingsEqual(a: DisplayPowerSettings, b: DisplayPowerSettings): boolean {
  return (
    a.kioskDisplayEnabled === b.kioskDisplayEnabled &&
    a.kioskDisplayScheduleEnabled === b.kioskDisplayScheduleEnabled &&
    a.kioskDisplayOnTime === b.kioskDisplayOnTime &&
    a.kioskDisplayOffTime === b.kioskDisplayOffTime &&
    a.kioskDisplayIdleOffSeconds === b.kioskDisplayIdleOffSeconds
  );
}

async function refreshDisplaySettings(apiBase: string): Promise<void> {
  try {
    const res = await fetch(`${apiBase}/api/settings`, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return;
    const data = (await res.json()) as Partial<DisplayPowerSettings>;
    const next = parseSettings(data);
    if (!settingsEqual(settings, next)) {
      settings = next;
      appliedOn = null;
    }
    await syncDisplayPower();
  } catch {
    // Keep previous settings if the web app is temporarily unreachable.
  }
}

export function startDisplayPowerControl(apiBase: string): void {
  if (process.platform !== "linux") return;

  void refreshDisplaySettings(apiBase);
  setInterval(() => void refreshDisplaySettings(apiBase), SETTINGS_POLL_MS);
  setInterval(() => void syncDisplayPower(), APPLY_INTERVAL_MS);
}
