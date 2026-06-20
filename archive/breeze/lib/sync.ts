import { addDays, format } from "date-fns";
import { prisma, getSettings } from "@/lib/db";
import { parseCalendarIds, parseWallClockDatetime } from "@/lib/utils";
import { getBreezeClientFromSettings } from "./client";
import type { BreezeEvent, BreezeSyncResult } from "./types";

function parseBreezeDateTime(value: string | undefined): Date | null {
  if (!value || value.startsWith("0000-00-00")) return null;
  const withoutTz = value.replace(/[Zz]|[+-]\d{2}:?\d{2}$/, "").trim();
  try {
    const date = parseWallClockDatetime(withoutTz);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

async function fetchAllBreezeEvents(
  calendarIds: string[],
  start: string,
  end: string,
): Promise<BreezeEvent[]> {
  const client = await getBreezeClientFromSettings();
  if (!client) {
    throw new Error("Breeze is not configured. Set subdomain and API key in settings or environment.");
  }

  if (calendarIds.length === 0) {
    return client.listEvents({ start, end, details: true });
  }

  const results = await Promise.all(
    calendarIds.map((categoryId) =>
      client.listEvents({ start, end, categoryId, details: true }),
    ),
  );

  const byId = new Map<string, BreezeEvent>();
  for (const event of results.flat()) {
    byId.set(event.id, event);
  }
  return Array.from(byId.values());
}

export async function syncBreezeEvents(): Promise<BreezeSyncResult> {
  const settings = await getSettings();
  const calendarIds = parseCalendarIds(settings.breezeCalendarIds);
  const start = format(new Date(), "yyyy-M-d");
  const end = format(addDays(new Date(), 90), "yyyy-M-d");

  let breezeEvents: BreezeEvent[];
  try {
    breezeEvents = await fetchAllBreezeEvents(calendarIds, start, end);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await prisma.settings.update({
      where: { id: "default" },
      data: { lastBreezeSyncError: message },
    });
    throw error;
  }

  const syncedAt = new Date();
  const parsedEvents: Array<{
    breezeEvent: BreezeEvent;
    startAt: Date;
    endAt: Date | null;
  }> = [];

  for (const breezeEvent of breezeEvents) {
    const startAt = parseBreezeDateTime(breezeEvent.start_datetime);
    if (!startAt) continue;

    parsedEvents.push({
      breezeEvent,
      startAt,
      endAt: parseBreezeDateTime(breezeEvent.end_datetime),
    });
  }

  const seenIds = new Set(parsedEvents.map((entry) => entry.breezeEvent.id));
  const existingEvents = await prisma.event.findMany({
    where: { breezeInstanceId: { in: Array.from(seenIds) } },
  });
  const existingByBreezeId = new Map(
    existingEvents.map((event) => [event.breezeInstanceId!, event]),
  );

  const writes: Array<ReturnType<typeof prisma.event.update> | ReturnType<typeof prisma.event.create>> =
    [];
  let created = 0;
  let updated = 0;

  for (const { breezeEvent, startAt, endAt } of parsedEvents) {
    const breezeOwned = {
      title: breezeEvent.name,
      startAt,
      endAt,
      breezeEventId: breezeEvent.event_id,
      breezeCategoryId: breezeEvent.category_id,
      breezeDescription: breezeEvent.description ?? null,
      syncStatus: "synced" as const,
      lastSyncedAt: syncedAt,
      source: "breeze" as const,
    };

    const existing = existingByBreezeId.get(breezeEvent.id);
    if (existing) {
      writes.push(
        prisma.event.update({
          where: { id: existing.id },
          data: breezeOwned,
        }),
      );
      updated += 1;
    } else {
      writes.push(
        prisma.event.create({
          data: {
            ...breezeOwned,
            breezeInstanceId: breezeEvent.id,
            status: "draft",
            kioskVisible: false,
          },
        }),
      );
      created += 1;
    }
  }

  if (writes.length > 0) {
    await prisma.$transaction(writes);
  }

  const staleResult = await prisma.event.updateMany({
    where: {
      source: "breeze",
      breezeInstanceId: { notIn: Array.from(seenIds) },
      syncStatus: { not: "stale" },
    },
    data: { syncStatus: "stale" },
  });

  await prisma.settings.update({
    where: { id: "default" },
    data: {
      lastBreezeSyncAt: syncedAt,
      lastBreezeSyncError: null,
    },
  });

  return {
    created,
    updated,
    stale: staleResult.count,
    total: breezeEvents.length,
    syncedAt: syncedAt.toISOString(),
  };
}
