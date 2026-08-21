import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth";
import { serializeEvent, serializeKioskEvent } from "@/lib/event-serialize";
import { deleteUploadIfUnreferenced } from "@/lib/upload-cleanup";
import { archivePastEventsIfDue } from "@/lib/archive-past-events";
import {
  eventIsActive,
  parseWallClockDatetime,
  wallClockNow,
  wallClockStartOfDay,
} from "@/lib/utils";
import { DEFAULT_EVENT_URL_LABEL } from "@/lib/event-url-label";
import { formatValidationError, manualEventSchema } from "@/lib/validators";

function saveErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not save event";
  const schemaDrift =
    message.includes("urlLabel") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2022");

  return NextResponse.json(
    {
      error: schemaDrift
        ? "Database schema is out of date. Stop the app and run npm run db:push --workspace=web."
        : message,
    },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  const kiosk = request.nextUrl.searchParams.get("kiosk") === "true";
  const status = request.nextUrl.searchParams.get("status");
  await archivePastEventsIfDue();
  const now = wallClockNow();

  if (kiosk) {
    const candidates = await prisma.event.findMany({
      where: {
        status: "published",
        kioskVisible: true,
        OR: [
          { endAt: { gte: now } },
          { endAt: null, startAt: { gte: wallClockStartOfDay(now) } },
        ],
      },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { startAt: "asc" }],
    });
    const events = candidates.filter((event) =>
      eventIsActive(event.startAt, event.endAt, event.allDay, now),
    );
    return NextResponse.json(events.map(serializeKioskEvent));
  }

  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const where =
    status === "draft" || status === "archived" ? { status } : {};

  const events = await prisma.event.findMany({
    where,
    orderBy: [{ startAt: "asc" }],
  });

  return NextResponse.json(events.map(serializeEvent));
}

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const parsed = manualEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatValidationError(parsed.error) }, { status: 400 });
  }

  const data = parsed.data;
  try {
    const event = await prisma.event.create({
      data: {
        source: "manual",
        syncStatus: "manual",
        title: data.title,
        startAt: parseWallClockDatetime(data.startAt),
        endAt: data.endAt ? parseWallClockDatetime(data.endAt) : null,
        allDay: data.allDay ?? false,
        shortDescription: data.shortDescription ?? null,
        fullDescription: data.fullDescription ?? null,
        location: data.location ?? null,
        imageUrl: data.imageUrl || null,
        registrationUrl: data.registrationUrl || null,
        urlLabel: data.urlLabel ?? DEFAULT_EVENT_URL_LABEL,
        featured: data.featured ?? false,
        sortOrder: data.sortOrder ?? 0,
        kioskVisible: data.kioskVisible ?? true,
        status: data.status ?? "draft",
      },
    });

    return NextResponse.json(serializeEvent(event), { status: 201 });
  } catch (error) {
    return saveErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = manualEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatValidationError(parsed.error) }, { status: 400 });
  }

  try {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const previousImageUrl = existing.imageUrl;
    const data = parsed.data;
    const event = await prisma.event.update({
      where: { id },
      data: {
        title: data.title,
        startAt: data.startAt ? parseWallClockDatetime(data.startAt) : undefined,
        endAt: data.endAt ? parseWallClockDatetime(data.endAt) : data.endAt === null ? null : undefined,
        shortDescription: data.shortDescription ?? null,
        fullDescription: data.fullDescription ?? null,
        location: data.location ?? null,
        imageUrl: data.imageUrl || null,
        registrationUrl: data.registrationUrl || null,
        urlLabel: data.urlLabel,
        featured: data.featured,
        sortOrder: data.sortOrder,
        kioskVisible: data.kioskVisible,
        allDay: data.allDay,
        status: data.status,
      },
    });

    if (previousImageUrl !== event.imageUrl) {
      await deleteUploadIfUnreferenced(previousImageUrl);
    }

    return NextResponse.json(serializeEvent(event));
  } catch (error) {
    return saveErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.event.delete({ where: { id } });
  await deleteUploadIfUnreferenced(existing.imageUrl);

  return NextResponse.json({ ok: true });
}
