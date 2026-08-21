import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth";
import { serializeEvent, serializeKioskEvent } from "@/lib/event-serialize";
import { eventIsActive, wallClockNow } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const kiosk = request.nextUrl.searchParams.get("kiosk") === "true";
  const event = await prisma.event.findUnique({ where: { id } });

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (kiosk) {
    const now = wallClockNow();
    if (
      event.status !== "published" ||
      !event.kioskVisible ||
      !eventIsActive(event.startAt, event.endAt, event.allDay, now)
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeKioskEvent(event));
  }

  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  return NextResponse.json(serializeEvent(event));
}
