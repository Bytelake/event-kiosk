const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

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

export function parseDisplayOnDays(value: unknown): number[] {
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

export function stringifyDisplayOnDays(days: number[]): string {
  return JSON.stringify(parseDisplayOnDays(days));
}

export function isDisplayOnDay(days: number[], now = new Date()): boolean {
  return days.includes(now.getDay());
}

export interface DisplayPowerSettings {
  kioskDisplayEnabled: boolean;
  kioskDisplayScheduleEnabled: boolean;
  kioskDisplayOnDays: number[];
  kioskDisplayOnTime: string;
  kioskDisplayOffTime: string;
  kioskDisplayIdleOffSeconds: number;
}

export const defaultDisplayPowerSettings: DisplayPowerSettings = {
  kioskDisplayEnabled: true,
  kioskDisplayScheduleEnabled: false,
  kioskDisplayOnDays: [0],
  kioskDisplayOnTime: "07:00",
  kioskDisplayOffTime: "22:00",
  kioskDisplayIdleOffSeconds: 0,
};

/**
 * Desired HDMI state from settings.
 *
 * When a weekly schedule is enabled:
 * - Selected days, during wake/sleep hours: stay on (idle does not blank the screen).
 * - Selected days, outside those hours: stay off (touch does not wake).
 * - Other days: stay off unless `lastActivityAt` is recent, then sleep again after idle.
 *
 * Pass `lastActivityAt: null` from the web app so weekday touch-wake is left to Electron.
 */
export function desiredDisplayOn(
  settings: DisplayPowerSettings,
  options?: { now?: Date; lastActivityAt?: number | null },
): boolean {
  if (!settings.kioskDisplayEnabled) return false;

  const now = options?.now ?? new Date();
  const lastActivityAt = options?.lastActivityAt;
  const idleMs = settings.kioskDisplayIdleOffSeconds * 1000;
  const idleExpired =
    idleMs > 0 && lastActivityAt != null && Date.now() - lastActivityAt >= idleMs;

  if (settings.kioskDisplayScheduleEnabled) {
    const scheduledDay = isDisplayOnDay(settings.kioskDisplayOnDays, now);
    const inHours = isInDisplayHours(
      settings.kioskDisplayOnTime,
      settings.kioskDisplayOffTime,
      now,
    );

    if (scheduledDay && inHours) return true;
    if (scheduledDay && !inHours) return false;

    if (idleMs <= 0 || lastActivityAt == null) return false;
    return !idleExpired;
  }

  if (lastActivityAt != null && idleExpired) return false;
  return true;
}
