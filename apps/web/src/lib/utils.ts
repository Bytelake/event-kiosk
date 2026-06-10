import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isValid, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse a timezone-naive datetime string as a wall-clock instant (stored as UTC components). */
export function parseWallClockDatetime(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const [datePart, timePart = "00:00"] = normalized.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min));
}

/** Format a wall-clock Date for use in a datetime-local input. */
export function toDatetimeLocalValue(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** Format a wall-clock Date for use in a date input. */
export function toDateLocalValue(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isWallClockMidnight(date: Date | string): boolean {
  const wc = wallClockDate(date);
  return wc.getHours() === 0 && wc.getMinutes() === 0;
}

/** Resolve all-day from the explicit flag or legacy midnight-only datetimes. */
export function eventIsAllDay(
  allDay: boolean | undefined,
  startAt: Date | string,
  endAt?: Date | string | null,
): boolean {
  if (allDay) return true;
  if (!isWallClockMidnight(startAt)) return false;
  if (!endAt) return true;
  return isWallClockMidnight(endAt);
}

/** Current wall-clock time on this device, encoded the same way as event datetimes. */
export function wallClockNow(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    ),
  );
}

function wallClockDate(date: Date | string): Date {
  const d = typeof date === "string" ? parseISO(date) : date;
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  );
}

export function formatEventDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "Date TBD";
  return format(wallClockDate(d), "EEEE, MMMM d, yyyy");
}

export function formatEventTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  const wc = wallClockDate(d);
  if (wc.getHours() === 0 && wc.getMinutes() === 0) return "All day";
  return format(wc, "h:mm a");
}

export function formatWallClockDateTime(
  date: Date | string,
  fmt = "MMM d, yyyy h:mm a",
): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  return format(wallClockDate(d), fmt);
}

export function getWallClockDay(date: Date | string): number {
  const d = typeof date === "string" ? parseISO(date) : date;
  return d.getUTCDate();
}

type WallClockParts = {
  date: Date;
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
};

function wallClockParts(date: Date | string): WallClockParts {
  const wc = wallClockDate(date);
  return {
    date: wc,
    year: wc.getFullYear(),
    month: wc.getMonth(),
    day: wc.getDate(),
    hours: wc.getHours(),
    minutes: wc.getMinutes(),
  };
}

function isAllDayTime(hours: number, minutes: number): boolean {
  return hours === 0 && minutes === 0;
}

export function isSameWallClockDay(
  startAt: Date | string,
  endAt: Date | string,
): boolean {
  const start = wallClockParts(startAt);
  const end = wallClockParts(endAt);
  return (
    start.year === end.year &&
    start.month === end.month &&
    start.day === end.day
  );
}

function timeOfDayMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

/** Multi-day event with the same start/end clock times each day (e.g. 9am–12pm Mon–Thu). */
export function isDailyRecurringSchedule(
  startAt: Date | string,
  endAt: Date | string,
): boolean {
  if (isSameWallClockDay(startAt, endAt)) return false;

  const start = wallClockParts(startAt);
  const end = wallClockParts(endAt);
  if (isAllDayTime(start.hours, start.minutes) && isAllDayTime(end.hours, end.minutes)) {
    return false;
  }

  return (
    timeOfDayMinutes(end.hours, end.minutes) >
    timeOfDayMinutes(start.hours, start.minutes)
  );
}

export function formatEventDateRange(
  startAt: Date | string,
  endAt: Date | string,
  options?: { includeWeekday?: boolean },
): string {
  const includeWeekday = options?.includeWeekday ?? false;
  const start = wallClockParts(startAt);
  const end = wallClockParts(endAt);

  if (includeWeekday) {
    if (start.year === end.year) {
      return `${format(start.date, "EEEE, MMMM d")} – ${format(end.date, "EEEE, MMMM d, yyyy")}`;
    }
    return `${formatEventDate(startAt)} – ${formatEventDate(endAt)}`;
  }

  if (start.year === end.year && start.month === end.month) {
    return `${format(start.date, "MMMM d")} – ${format(end.date, "d, yyyy")}`;
  }
  if (start.year === end.year) {
    return `${format(start.date, "MMMM d")} – ${format(end.date, "MMMM d, yyyy")}`;
  }
  return `${format(start.date, "MMMM d, yyyy")} – ${format(end.date, "MMMM d, yyyy")}`;
}

export type KioskEventSchedule = {
  dates: string;
  times: string;
  variant: "single" | "daily" | "span" | "all-day";
};

export function formatKioskEventSchedule(
  startAt: Date | string,
  endAt: Date | string | null,
  allDay = false,
): KioskEventSchedule {
  if (eventIsAllDay(allDay, startAt, endAt)) {
    const dates =
      !endAt || isSameWallClockDay(startAt, endAt)
        ? formatEventDate(startAt)
        : formatEventDateRange(startAt, endAt, { includeWeekday: true });
    return { dates, times: "All day", variant: "all-day" };
  }

  const startTime = formatEventTime(startAt);

  if (!endAt) {
    return {
      dates: formatEventDate(startAt),
      times: startTime,
      variant: startTime === "All day" ? "all-day" : "single",
    };
  }

  const endTime = formatEventTime(endAt);
  const start = wallClockParts(startAt);
  const end = wallClockParts(endAt);

  if (isAllDayTime(start.hours, start.minutes) && isAllDayTime(end.hours, end.minutes)) {
    return {
      dates: formatEventDateRange(startAt, endAt, { includeWeekday: true }),
      times: "All day",
      variant: "all-day",
    };
  }

  if (isSameWallClockDay(startAt, endAt)) {
    const dates = formatEventDate(startAt);
    if (startTime === "All day" || endTime === "All day") {
      return { dates, times: "All day", variant: "all-day" };
    }
    if (startTime === endTime) {
      return { dates, times: startTime, variant: "single" };
    }
    return { dates, times: `${startTime} – ${endTime}`, variant: "single" };
  }

  if (isDailyRecurringSchedule(startAt, endAt)) {
    return {
      dates: formatEventDateRange(startAt, endAt, { includeWeekday: true }),
      times:
        startTime === "All day" || endTime === "All day"
          ? "All day"
          : `${startTime} – ${endTime} daily`,
      variant: "daily",
    };
  }

  return {
    dates: formatEventDateRange(startAt, endAt, { includeWeekday: true }),
    times: `${startTime} – ${endTime}`,
    variant: "span",
  };
}

export function formatKioskEventScheduleDisplay(
  startAt: Date | string,
  endAt: Date | string | null,
  allDay = false,
): string {
  const schedule = formatKioskEventSchedule(startAt, endAt, allDay);

  if (schedule.variant === "span" && endAt) {
    const startFmt = formatWallClockDateTime(startAt, "EEEE, MMMM d, yyyy h:mm a");
    const endFmt = formatWallClockDateTime(endAt, "EEEE, MMMM d, yyyy h:mm a");
    return `${startFmt} – ${endFmt}`;
  }

  if (!schedule.times || schedule.times === schedule.dates) {
    return schedule.dates;
  }

  return `${schedule.dates} · ${schedule.times}`;
}

/** Card summary: dates only for multi-day events; full schedule for single-day. */
export function formatKioskEventCardDisplay(
  startAt: Date | string,
  endAt: Date | string | null,
  allDay = false,
): string {
  if (!endAt || isSameWallClockDay(startAt, endAt)) {
    return formatKioskEventScheduleDisplay(startAt, endAt, allDay);
  }
  return formatKioskEventSchedule(startAt, endAt, allDay).dates;
}

export type EventCardDateBadge = {
  label: string;
  day: string;
  time: string;
};

function formatBadgeTime(times: string): string {
  return times.replace(/\s–\s/g, " - ").replace(/ daily$/, "");
}

export function formatEventCardDateBadge(
  startAt: Date | string,
  endAt: Date | string | null,
  allDay = false,
): EventCardDateBadge {
  const schedule = formatKioskEventSchedule(startAt, endAt, allDay);

  if (!endAt || isSameWallClockDay(startAt, endAt)) {
    const start = wallClockParts(startAt);
    const now = wallClockParts(wallClockNow());
    const isCurrentMonth = start.year === now.year && start.month === now.month;

    return {
      label: isCurrentMonth
        ? formatEventDate(startAt).split(",")[0]
        : format(start.date, "MMMM"),
      day: String(getWallClockDay(startAt)),
      time: formatBadgeTime(schedule.times),
    };
  }

  const start = wallClockParts(startAt);
  const end = wallClockParts(endAt);
  const sameMonth = start.year === end.year && start.month === end.month;

  if (sameMonth) {
    return {
      label: format(start.date, "MMM").toUpperCase(),
      day: `${start.day} - ${end.day}`,
      time: formatBadgeTime(schedule.times),
    };
  }

  return {
    label: format(start.date, "MMM").toUpperCase(),
    day: `${start.day} - ${format(end.date, "MMM d")}`,
    time: formatBadgeTime(schedule.times),
  };
}

export function parseCalendarIds(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // ignore
  }
  return [];
}
