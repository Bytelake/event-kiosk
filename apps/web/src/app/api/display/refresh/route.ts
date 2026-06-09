import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export async function POST() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.settings.update({
    where: { id: "default" },
    data: { kioskRefreshAt: new Date() },
  });

  return NextResponse.json({
    kioskRefreshAt: settings.kioskRefreshAt?.toISOString() ?? null,
  });
}
