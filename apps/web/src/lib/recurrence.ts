import { format, isValid, parseISO } from "date-fns";
import {
  eventHasEnded,
  parseWallClockDatetime,
  toDateLocalValue,
  wallClockNow,
} from "@/lib/utils";
export const RECURRENCE_FREQUENCIES = ["none", "daily", "weekly", "monthly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export type RecurrenceFields = {
  startAt: Date | string;
  endAt?: Date | string | null;
  allDay?: boolean;
  recurrenceFrequency?: string | null;
  recurrenceInterval?: number | null;
  recurrenceDays?: string | number[] | null;
  recurrenceUntil?: Date | string | null;
};

export type OccurrenceWindow = {
  startAt: Date;
  endAt: Date | null;
};

function asDate(value: Date | string): Date {
  return typeof value === "string" ? parseISO(value) : value;
}

function wallClockUtcParts(date: Date | string) {
  const d = asDate(date);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    seconds: d.getUTCSeconds(),
    ms: d.getUTCMilliseconds(),
    weekday: d.getUTCDay(),
  };
}

function makeWallClockDate(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  ms = 0,
): Date {
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds, ms));
}

export function addWallClockDays(date: Date | string, days: number): Date {
  const p = wallClockUtcParts(date);
  return makeWallClockDate(p.year, p.month, p.day + days, p.hours, p.minutes, p.seconds, p.ms);
}

function addWallClockMonths(date: Date | string, months: number): Date {
  const p = wallClockUtcParts(date);
  const anchor = makeWallClockDate(p.year, p.month + months, 1, p.hours, p.minutes, p.seconds, p.ms);
  const daysInMonth = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(p.day, daysInMonth);
  return makeWallClockDate(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth(),
    day,
    p.hours,
    p.minutes,
    p.seconds,
    p.ms,
  );
}

function startOfWallClockDay(date: Date | string): Date {
  const p = wallClockUtcParts(date);
  return makeWallClockDate(p.year, p.month, p.day, 0, 0, 0, 0);
}

function calendarDaysBetween(start: Date | string, end: Date | string): number {
  const a = startOfWallClockDay(start).getTime();
  const b = startOfWallClockDay(end).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function isRecurrenceFrequency(value: unknown): value is RecurrenceFrequency {
  return (
    typeof value === "string" &&
    (RECURRENCE_FREQUENCIES as readonly string[]).includes(value)
  );
}

export function normalizeRecurrenceFrequency(value: unknown): RecurrenceFrequency {
  return isRecurrenceFrequency(value) ? value : "none";
}

export function parseRecurrenceDays(value: unknown): number[] {
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];

  return [
    ...new Set(
      raw.filter(
        (day): day is number =>
          typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
      ),
    ),
  ].sort((a, b) => a - b);
}

export function stringifyRecurrenceDays(days: number[]): string {
  return JSON.stringify(parseRecurrenceDays(days));
}

export function normalizeRecurrenceInterval(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, 366);
}

export function eventIsRecurring(event: Pick<RecurrenceFields, "recurrenceFrequency">): boolean {
  const frequency = normalizeRecurrenceFrequency(event.recurrenceFrequency);
  return frequency !== "none";
}

function occurrenceDurationMs(event: RecurrenceFields): number | null {
  if (!event.endAt) return null;
  const start = asDate(event.startAt).getTime();
  const end = asDate(event.endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}

function occurrenceEnd(startAt: Date, event: RecurrenceFields): Date | null {
  const duration = occurrenceDurationMs(event);
  if (duration === null) return null;
  return new Date(startAt.getTime() + duration);
}

function untilLimit(event: RecurrenceFields): Date | null {
  if (!event.recurrenceUntil) return null;
  const until = asDate(event.recurrenceUntil);
  if (!isValid(until)) return null;
  return startOfWallClockDay(until);
}

function isOnOrBeforeUntil(occurrenceStart: Date, until: Date | null): boolean {
  if (!until) return true;
  return startOfWallClockDay(occurrenceStart).getTime() <= until.getTime();
}

function weeklyDaysFor(event: RecurrenceFields): number[] {
  const days = parseRecurrenceDays(event.recurrenceDays);
  if (days.length > 0) return days;
  return [wallClockUtcParts(event.startAt).weekday];
}

/**
 * Yield occurrence starts from the series start forward.
 * Caps the scan so callers cannot loop forever on open-ended series.
 */
export function* iterateOccurrenceStarts(
  event: RecurrenceFields,
  options?: { maxOccurrences?: number; through?: Date },
): Generator<Date> {
  const frequency = normalizeRecurrenceFrequency(event.recurrenceFrequency);
  const interval = normalizeRecurrenceInterval(event.recurrenceInterval);
  const seriesStart = asDate(event.startAt);
  if (!isValid(seriesStart)) return;

  const until = untilLimit(event);
  const maxOccurrences = options?.maxOccurrences ?? 400;
  const through = options?.through ? startOfWallClockDay(options.through) : null;
  let yielded = 0;

  const pass = (occurrence: Date): boolean => {
    if (occurrence.getTime() < seriesStart.getTime()) return false;
    if (!isOnOrBeforeUntil(occurrence, until)) return false;
    if (through && startOfWallClockDay(occurrence).getTime() > through.getTime()) return false;
    return true;
  };

  if (frequency === "none") {
    if (pass(seriesStart)) yield seriesStart;
    return;
  }

  if (frequency === "daily") {
    let cursor = seriesStart;
    while (yielded < maxOccurrences) {
      if (!isOnOrBeforeUntil(cursor, until)) return;
      if (through && startOfWallClockDay(cursor).getTime() > through.getTime()) return;
      if (pass(cursor)) {
        yield cursor;
        yielded += 1;
      }
      cursor = addWallClockDays(cursor, interval);
    }
    return;
  }

  if (frequency === "weekly") {
    const days = new Set(weeklyDaysFor(event));
    let dayCursor = startOfWallClockDay(seriesStart);
    // Include the series start day even if we need its time-of-day later.
    while (yielded < maxOccurrences) {
      if (!isOnOrBeforeUntil(dayCursor, until)) return;
      if (through && dayCursor.getTime() > through.getTime()) return;

      const dayDiff = calendarDaysBetween(seriesStart, dayCursor);
      const weekIndex = Math.floor(dayDiff / 7);
      const weekday = dayCursor.getUTCDay();
      if (days.has(weekday) && weekIndex % interval === 0) {
        const p = wallClockUtcParts(seriesStart);
        const occurrence = makeWallClockDate(
          dayCursor.getUTCFullYear(),
          dayCursor.getUTCMonth(),
          dayCursor.getUTCDate(),
          p.hours,
          p.minutes,
          p.seconds,
          p.ms,
        );
        if (occurrence.getTime() >= seriesStart.getTime()) {
          yield occurrence;
          yielded += 1;
        }
      }
      dayCursor = addWallClockDays(dayCursor, 1);
    }
    return;
  }

  if (frequency === "monthly") {
    // Always advance from the series start so day-of-month is preserved
    // across short months (Jan 31 → Feb 28 → Mar 31).
    let monthOffset = 0;
    while (yielded < maxOccurrences) {
      const occurrence = addWallClockMonths(seriesStart, monthOffset);
      if (!isOnOrBeforeUntil(occurrence, until)) return;
      if (through && startOfWallClockDay(occurrence).getTime() > through.getTime()) return;
      if (pass(occurrence)) {
        yield occurrence;
        yielded += 1;
      }
      monthOffset += interval;
    }
  }
}

export function getOccurrenceWindow(startAt: Date, event: RecurrenceFields): OccurrenceWindow {
  return {
    startAt,
    endAt: occurrenceEnd(startAt, event),
  };
}

/** Next occurrence that has not fully ended yet, or null if the series is finished. */
export function getNextOccurrence(
  event: RecurrenceFields,
  now: Date = wallClockNow(),
): OccurrenceWindow | null {
  const frequency = normalizeRecurrenceFrequency(event.recurrenceFrequency);
  if (frequency === "none") {
    if (eventHasEnded(event.startAt, event.endAt, event.allDay ?? false, now)) {
      return null;
    }
    return {
      startAt: asDate(event.startAt),
      endAt: event.endAt ? asDate(event.endAt) : null,
    };
  }

  // Scan forward far enough for monthly/weekly intervals.
  const through = addWallClockMonths(now, Math.max(normalizeRecurrenceInterval(event.recurrenceInterval) * 24, 24));
  for (const startAt of iterateOccurrenceStarts(event, { through, maxOccurrences: 500 })) {
    const window = getOccurrenceWindow(startAt, event);
    if (!eventHasEnded(window.startAt, window.endAt, event.allDay ?? false, now)) {
      return window;
    }
  }
  return null;
}

export function eventSeriesHasEnded(
  event: RecurrenceFields,
  now: Date = wallClockNow(),
): boolean {
  return getNextOccurrence(event, now) === null;
}

export function eventSeriesIsActive(
  event: RecurrenceFields,
  now: Date = wallClockNow(),
): boolean {
  return !eventSeriesHasEnded(event, now);
}

export function formatRecurrenceSummary(event: RecurrenceFields): string | null {
  const frequency = normalizeRecurrenceFrequency(event.recurrenceFrequency);
  if (frequency === "none") return null;

  const interval = normalizeRecurrenceInterval(event.recurrenceInterval);
  let base: string;

  if (frequency === "daily") {
    base = interval === 1 ? "Every day" : `Every ${interval} days`;
  } else if (frequency === "weekly") {
    const days = weeklyDaysFor(event);
    // 2024-01-07 is a Sunday; add weekday offset for long names.
    const dayLabels = days.map((day) => format(new Date(2024, 0, 7 + day), "EEEE"));
    const dayText =
      dayLabels.length === 0
        ? "week"
        : dayLabels.length === 7
          ? "day"
          : dayLabels.join(", ");
    if (interval === 1) {
      base = dayLabels.length === 7 ? "Every day" : `Every ${dayText}`;
    } else {
      base = `Every ${interval} weeks on ${dayText}`;
    }
  } else {
    const day = wallClockUtcParts(event.startAt).day;
    base =
      interval === 1
        ? `Monthly on day ${day}`
        : `Every ${interval} months on day ${day}`;
  }

  if (event.recurrenceUntil) {
    const until = asDate(event.recurrenceUntil);
    if (isValid(until)) {
      const label = format(
        new Date(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate()),
        "MMM d, yyyy",
      );
      return `${base} until ${label}`;
    }
  }

  return base;
}

/** Admin/API payload helpers */
export function recurrenceCreateData(input: {
  recurrenceFrequency?: string | null;
  recurrenceInterval?: number | null;
  recurrenceDays?: number[] | string | null;
  recurrenceUntil?: string | null;
  startAt: string;
}) {
  const frequency = normalizeRecurrenceFrequency(input.recurrenceFrequency);
  if (frequency === "none") {
    return {
      recurrenceFrequency: "none" as const,
      recurrenceInterval: 1,
      recurrenceDays: "[]",
      recurrenceUntil: null as Date | null,
    };
  }

  let days = parseRecurrenceDays(input.recurrenceDays);
  if (frequency === "weekly" && days.length === 0) {
    days = [wallClockUtcParts(parseWallClockDatetime(input.startAt)).weekday];
  }

  return {
    recurrenceFrequency: frequency,
    recurrenceInterval: normalizeRecurrenceInterval(input.recurrenceInterval),
    recurrenceDays: frequency === "weekly" ? stringifyRecurrenceDays(days) : "[]",
    recurrenceUntil: input.recurrenceUntil
      ? parseWallClockDatetime(`${toDateLocalValue(input.recurrenceUntil)}T00:00`)
      : null,
  };
}
