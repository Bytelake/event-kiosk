import type { Event } from "@prisma/client";
import {
  formatRecurrenceSummary,
  getNextOccurrence,
  normalizeRecurrenceFrequency,
  parseRecurrenceDays,
} from "@/lib/recurrence";
import { wallClockNow } from "@/lib/utils";

export function serializeEvent(event: Event) {
  return {
    ...event,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt?.toISOString() ?? null,
    lastSyncedAt: event.lastSyncedAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    recurrenceFrequency: normalizeRecurrenceFrequency(event.recurrenceFrequency),
    recurrenceInterval: event.recurrenceInterval ?? 1,
    recurrenceDays: parseRecurrenceDays(event.recurrenceDays),
    recurrenceUntil: event.recurrenceUntil?.toISOString() ?? null,
    recurrenceSummary: formatRecurrenceSummary(event),
  };
}

/** Kiosk payload with start/end shifted to the next active occurrence. */
export function serializeKioskEvent(event: Event, now: Date = wallClockNow()) {
  const next = getNextOccurrence(event, now);
  if (!next) return null;

  const base = serializeEvent(event);
  return {
    ...base,
    startAt: next.startAt.toISOString(),
    endAt: next.endAt?.toISOString() ?? null,
  };
}
