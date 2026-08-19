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
  kioskDisplayOnDays: number[];
  kioskDisplayOnTime: string;
  kioskDisplayOffTime: string;
}

const defaults: DisplayPowerSettings = {
  kioskDisplayEnabled: true,
  kioskDisplayScheduleEnabled: false,
  kioskDisplayOnDays: [0],
  kioskDisplayOnTime: "07:00",
  kioskDisplayOffTime: "22:00",
};

let settings: DisplayPowerSettings = { ...defaults };
let appliedOn: boolean | null = null;
let applying = false;

function parseHhMm(value: string): number | null {
  const match = HH_MM.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseDisplayOnDays(value: unknown): number[] {
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return [0];
    }
  }
  if (!Array.isArray(raw)) return [0];
  const days = [
    ...new Set(
      raw.filter(
        (day): day is number =>
          typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
      ),
    ),
  ].sort((a, b) => a - b);
  return days.length > 0 ? days : [0];
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
  if (!settings.kioskDisplayScheduleEnabled) return true;
  return (
    settings.kioskDisplayOnDays.includes(now.getDay()) &&
    isInDisplayHours(settings.kioskDisplayOnTime, settings.kioskDisplayOffTime, now)
  );
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
  // HDMI sleep also powers down the panel touch, so there is no wake-on-touch.
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
    kioskDisplayOnDays: parseDisplayOnDays(data.kioskDisplayOnDays),
    kioskDisplayOnTime:
      typeof data.kioskDisplayOnTime === "string" && parseHhMm(data.kioskDisplayOnTime) !== null
        ? data.kioskDisplayOnTime
        : defaults.kioskDisplayOnTime,
    kioskDisplayOffTime:
      typeof data.kioskDisplayOffTime === "string" && parseHhMm(data.kioskDisplayOffTime) !== null
        ? data.kioskDisplayOffTime
        : defaults.kioskDisplayOffTime,
  };
}

function settingsEqual(a: DisplayPowerSettings, b: DisplayPowerSettings): boolean {
  return (
    a.kioskDisplayEnabled === b.kioskDisplayEnabled &&
    a.kioskDisplayScheduleEnabled === b.kioskDisplayScheduleEnabled &&
    a.kioskDisplayOnDays.join(",") === b.kioskDisplayOnDays.join(",") &&
    a.kioskDisplayOnTime === b.kioskDisplayOnTime &&
    a.kioskDisplayOffTime === b.kioskDisplayOffTime
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
