import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db";

export async function GET() {
  const settings = await getSettings();

  return NextResponse.json({
    kioskRefreshAt: settings.kioskRefreshAt?.toISOString() ?? null,
    settingsUpdatedAt: settings.settingsUpdatedAt?.toISOString() ?? null,
  });
}
