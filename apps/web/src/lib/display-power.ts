import { execFile } from "child_process";
import { access } from "fs/promises";
import path from "path";
import { promisify } from "util";
import {
  desiredDisplayOn,
  parseDisplayOnDays,
  type DisplayPowerSettings,
} from "@/lib/display-schedule";
import { isDesktopMode } from "@/lib/kiosk-mode";

const execFileAsync = promisify(execFile);
const APPLY_TIMEOUT_MS = 8_000;

export type DisplayPowerHardware = {
  on: boolean | null;
  method: string | null;
  available: boolean;
  error: string | null;
};

function displayPowerScriptPath(): string {
  return path.join(process.env.KIOSK_ROOT || "/opt/kiosk", "bin", "set-display-power.sh");
}

/**
 * Whether the host has the display-power helper. Do **not** gate on
 * `process.platform === "linux"` here — Debian packages are built on macOS, and
 * Turbopack DCE treats that check as always-false at build time, which strips
 * the real Linux implementation from production bundles.
 */
async function scriptExists(): Promise<boolean> {
  if (isDesktopMode()) return false;
  try {
    await access(displayPowerScriptPath());
    return true;
  } catch {
    return false;
  }
}

function parseStatusOutput(stdout: string): { on: boolean | null; method: string | null } {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let on: boolean | null = null;
  let method: string | null = null;
  for (const line of lines) {
    if (line === "on") on = true;
    else if (line === "off") on = false;
    else if (line === "unknown") on = null;
    else if (line.startsWith("method=")) method = line.slice("method=".length) || null;
  }
  return { on, method: method === "none" ? null : method };
}

function settingsToDisplayPower(
  settings: Omit<DisplayPowerSettings, "kioskDisplayOnDays"> & {
    kioskDisplayOnDays: DisplayPowerSettings["kioskDisplayOnDays"] | string;
  },
): DisplayPowerSettings {
  return {
    kioskDisplayEnabled: settings.kioskDisplayEnabled,
    kioskDisplayScheduleEnabled: settings.kioskDisplayScheduleEnabled,
    kioskDisplayOnDays: parseDisplayOnDays(settings.kioskDisplayOnDays),
    kioskDisplayOnTime: settings.kioskDisplayOnTime,
    kioskDisplayOffTime: settings.kioskDisplayOffTime,
  };
}

export async function readDisplayHardwareStatus(): Promise<DisplayPowerHardware> {
  if (!(await scriptExists())) {
    return { on: null, method: null, available: false, error: null };
  }

  try {
    const { stdout } = await execFileAsync(displayPowerScriptPath(), ["status"], {
      timeout: APPLY_TIMEOUT_MS,
      env: process.env,
    });
    const parsed = parseStatusOutput(stdout);
    return {
      on: parsed.on,
      method: parsed.method,
      available: parsed.method != null || parsed.on != null,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read display power status";
    return { on: null, method: null, available: false, error: message };
  }
}

export async function applyScheduledDisplayPower(
  settings: Parameters<typeof settingsToDisplayPower>[0],
): Promise<DisplayPowerHardware> {
  if (!(await scriptExists())) {
    return { on: null, method: null, available: false, error: null };
  }

  const wantOn = desiredDisplayOn(settingsToDisplayPower(settings));
  try {
    const { stdout } = await execFileAsync(displayPowerScriptPath(), [wantOn ? "on" : "off"], {
      timeout: APPLY_TIMEOUT_MS,
      env: process.env,
    });
    const methodLine = stdout
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("method="));
    return {
      on: wantOn,
      method: methodLine?.slice("method=".length) || null,
      available: true,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to apply display power";
    return { on: null, method: null, available: false, error: message };
  }
}
