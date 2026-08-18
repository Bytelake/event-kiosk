const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseHhMm(value: string): number | null {
  const match = HH_MM.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isValidHhMm(value: string): boolean {
  return parseHhMm(value) !== null;
}

/** Minutes since local midnight. */
export function localMinutesSinceMidnight(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Whether the display should be on for a daily on/off window in local time.
 * Equal on/off times mean 24h on. If onTime > offTime the window wraps midnight.
 */
export function isInDisplayHours(
  onTime: string,
  offTime: string,
  now = new Date(),
): boolean {
  const on = parseHhMm(onTime);
  const off = parseHhMm(offTime);
  if (on === null || off === null) return true;
  if (on === off) return true;

  const minutes = localMinutesSinceMidnight(now);
  if (on < off) {
    return minutes >= on && minutes < off;
  }
  return minutes >= on || minutes < off;
}

export interface DisplayPowerSettings {
  kioskDisplayEnabled: boolean;
  kioskDisplayScheduleEnabled: boolean;
  kioskDisplayOnTime: string;
  kioskDisplayOffTime: string;
  kioskDisplayIdleOffSeconds: number;
}

export const defaultDisplayPowerSettings: DisplayPowerSettings = {
  kioskDisplayEnabled: true,
  kioskDisplayScheduleEnabled: false,
  kioskDisplayOnTime: "07:00",
  kioskDisplayOffTime: "22:00",
  kioskDisplayIdleOffSeconds: 0,
};

/**
 * Desired HDMI state from settings. `lastActivityAt` is only used for idle sleep;
 * pass null from the web app so idle is left to the Electron shell.
 */
export function desiredDisplayOn(
  settings: DisplayPowerSettings,
  options?: { now?: Date; lastActivityAt?: number | null },
): boolean {
  if (!settings.kioskDisplayEnabled) return false;

  if (
    settings.kioskDisplayScheduleEnabled &&
    !isInDisplayHours(settings.kioskDisplayOnTime, settings.kioskDisplayOffTime, options?.now)
  ) {
    return false;
  }

  const lastActivityAt = options?.lastActivityAt;
  if (
    lastActivityAt != null &&
    settings.kioskDisplayIdleOffSeconds > 0 &&
    Date.now() - lastActivityAt >= settings.kioskDisplayIdleOffSeconds * 1000
  ) {
    return false;
  }

  return true;
}
