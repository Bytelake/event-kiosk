import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getBreezeClientFromSettings } from "@/lib/breeze/client";

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getBreezeClientFromSettings();
  if (!client) {
    return NextResponse.json(
      { error: "Breeze is not configured" },
      { status: 400 },
    );
  }

  try {
    const calendars = await client.listCalendars();
    return NextResponse.json(calendars);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch calendars";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
