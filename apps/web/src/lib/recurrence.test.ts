import assert from "node:assert/strict";
import {
  eventSeriesHasEnded,
  formatRecurrenceSummary,
  getNextOccurrence,
  iterateOccurrenceStarts,
  parseRecurrenceDays,
} from "./recurrence";
import { parseWallClockDatetime } from "./utils";

function wall(isoLocal: string) {
  return parseWallClockDatetime(isoLocal);
}

{
  const days = parseRecurrenceDays("[0,3,0]");
  assert.deepEqual(days, [0, 3]);
}

{
  const event = {
    startAt: wall("2026-04-05T10:00"), // Sunday
    endAt: wall("2026-04-05T11:30"),
    allDay: false,
    recurrenceFrequency: "weekly",
    recurrenceInterval: 1,
    recurrenceDays: [0],
    recurrenceUntil: null,
  };

  const starts = [...iterateOccurrenceStarts(event, { maxOccurrences: 3 })].map((d) =>
    d.toISOString(),
  );
  assert.deepEqual(starts, [
    "2026-04-05T10:00:00.000Z",
    "2026-04-12T10:00:00.000Z",
    "2026-04-19T10:00:00.000Z",
  ]);

  const next = getNextOccurrence(event, wall("2026-04-06T09:00"));
  assert.equal(next?.startAt.toISOString(), "2026-04-12T10:00:00.000Z");
  assert.equal(next?.endAt?.toISOString(), "2026-04-12T11:30:00.000Z");
  assert.equal(formatRecurrenceSummary(event), "Every Sunday");
  assert.equal(eventSeriesHasEnded(event, wall("2026-04-06T09:00")), false);
}

{
  const event = {
    startAt: wall("2026-04-05T10:00"),
    endAt: wall("2026-04-05T11:00"),
    allDay: false,
    recurrenceFrequency: "weekly",
    recurrenceInterval: 1,
    recurrenceDays: [0],
    recurrenceUntil: wall("2026-04-05T00:00"),
  };
  assert.equal(eventSeriesHasEnded(event, wall("2026-04-05T12:00")), true);
  assert.equal(getNextOccurrence(event, wall("2026-04-05T12:00")), null);
}

{
  const event = {
    startAt: wall("2026-01-31T09:00"),
    endAt: wall("2026-01-31T10:00"),
    allDay: false,
    recurrenceFrequency: "monthly",
    recurrenceInterval: 1,
    recurrenceDays: [],
    recurrenceUntil: null,
  };
  const starts = [...iterateOccurrenceStarts(event, { maxOccurrences: 3 })].map((d) =>
    d.toISOString().slice(0, 10),
  );
  assert.deepEqual(starts, ["2026-01-31", "2026-02-28", "2026-03-31"]);
}

{
  const event = {
    startAt: wall("2026-04-06T18:00"), // Monday
    endAt: wall("2026-04-06T19:00"),
    allDay: false,
    recurrenceFrequency: "weekly",
    recurrenceInterval: 2,
    recurrenceDays: [1, 3],
    recurrenceUntil: null,
  };
  const starts = [...iterateOccurrenceStarts(event, { maxOccurrences: 4 })].map((d) =>
    d.toISOString().slice(0, 10),
  );
  assert.deepEqual(starts, ["2026-04-06", "2026-04-08", "2026-04-20", "2026-04-22"]);
  assert.equal(formatRecurrenceSummary(event), "Every 2 weeks on Monday, Wednesday");
}

console.log("recurrence.test.ts: all assertions passed");
