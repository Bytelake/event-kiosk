import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { parseWallClockDatetime, wallClockNow } from "@/lib/utils";
import { eventEnrichSchema, manualEventSchema } from "@/lib/validators";

function serializeEvent(event: Awaited<ReturnType<typeof prisma.event.findMany>>[number]) {
  return {
    ...event,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt?.toISOString() ?? null,
    lastSyncedAt: event.lastSyncedAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const kiosk = request.nextUrl.searchParams.get("kiosk") === "true";
  const source = request.nextUrl.searchParams.get("source");
  const now = wallClockNow();

  if (kiosk) {
    const events = await prisma.event.findMany({
      where: {
        status: "published",
        kioskVisible: true,
        startAt: { gte: now },
      },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { startAt: "asc" }],
    });
    return NextResponse.json(events.map(serializeEvent));
  }

  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where =
    source === "breeze"
      ? { source: "breeze" as const }
      : source === "manual"
        ? { source: "manual" as const }
        : source === "hidden"
          ? { kioskVisible: false }
          : {};

  const events = await prisma.event.findMany({
    where,
    orderBy: [{ startAt: "asc" }],
  });

  return NextResponse.json(events.map(serializeEvent));
}

export async function POST(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = manualEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
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
      imageUrl: data.imageUrl ?? null,
      registrationUrl: data.registrationUrl || null,
      featured: data.featured ?? false,
      sortOrder: data.sortOrder ?? 0,
      kioskVisible: data.kioskVisible ?? true,
      status: data.status ?? "draft",
    },
  });

  return NextResponse.json(serializeEvent(event), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();

  if (existing.source === "breeze") {
    const parsed = eventEnrichSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const event = await prisma.event.update({
      where: { id },
      data: {
        shortDescription: data.shortDescription ?? null,
        fullDescription: data.fullDescription ?? null,
        location: data.location ?? null,
        imageUrl: data.imageUrl ?? null,
        registrationUrl: data.registrationUrl || null,
        featured: data.featured,
        sortOrder: data.sortOrder,
        kioskVisible: data.kioskVisible,
        allDay: data.allDay,
        status: data.status,
      },
    });
    return NextResponse.json(serializeEvent(event));
  }

  const parsed = manualEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

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
      imageUrl: data.imageUrl ?? null,
      registrationUrl: data.registrationUrl || null,
      featured: data.featured,
      sortOrder: data.sortOrder,
      kioskVisible: data.kioskVisible,
      allDay: data.allDay,
      status: data.status,
    },
  });

  return NextResponse.json(serializeEvent(event));
}

export async function DELETE(request: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
