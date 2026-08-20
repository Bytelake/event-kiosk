import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth";

export async function POST() {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const settings = await prisma.settings.update({
    where: { id: "default" },
    data: { kioskRefreshAt: new Date() },
  });

  return NextResponse.json({
    kioskRefreshAt: settings.kioskRefreshAt?.toISOString() ?? null,
  });
}
