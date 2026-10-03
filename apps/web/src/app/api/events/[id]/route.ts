import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { serializeEvent, serializeKioskEvent } from "@/lib/event-serialize";
import { wallClockNow } from "@/lib/utils";

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
    if (event.status !== "published" || !event.kioskVisible) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload = serializeKioskEvent(event, wallClockNow());
    if (!payload) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(payload);
  }

  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(serializeEvent(event));
}
