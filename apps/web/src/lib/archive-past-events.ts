import { prisma } from "@/lib/db";
import { isDatabaseMaintenanceMode } from "@/lib/database-maintenance";
import { eventHasEnded, wallClockNow } from "@/lib/utils";

const ARCHIVE_INTERVAL_MS = 60 * 60 * 1000;

let schedulerStarted = false;
let lastArchiveAt = 0;
let archiveInFlight: Promise<number> | null = null;

/** Move published events whose schedule has ended into archived status. */
export async function archivePastEvents(): Promise<number> {
  if (isDatabaseMaintenanceMode()) {
    return 0;
  }

  if (archiveInFlight) {
    return archiveInFlight;
  }

  archiveInFlight = (async () => {
    const now = wallClockNow();
    const candidates = await prisma.event.findMany({
      where: {
        status: "published",
        startAt: { lt: now },
      },
      select: { id: true, startAt: true, endAt: true, allDay: true },
    });

    const ids = candidates
      .filter((event) => eventHasEnded(event.startAt, event.endAt, event.allDay, now))
      .map((event) => event.id);

    if (ids.length === 0) {
      return 0;
    }

    const result = await prisma.event.updateMany({
      where: { id: { in: ids } },
      data: { status: "archived" },
    });

    return result.count;
  })();

  try {
    return await archiveInFlight;
  } finally {
    archiveInFlight = null;
    lastArchiveAt = Date.now();
  }
}

/** Run at most once per hour unless forced. */
export async function archivePastEventsIfDue(force = false): Promise<number> {
  if (!force && Date.now() - lastArchiveAt < ARCHIVE_INTERVAL_MS) {
    return 0;
  }
  return archivePastEvents();
}

export function startArchivePastEventsScheduler() {
  if (schedulerStarted || process.env.NODE_ENV === "test") {
    return;
  }
  schedulerStarted = true;

  void archivePastEventsIfDue(true);

  setInterval(() => {
    void archivePastEventsIfDue();
  }, ARCHIVE_INTERVAL_MS);
}
