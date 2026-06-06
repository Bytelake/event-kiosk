import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { syncBreezeEvents } from "@/lib/breeze/sync";

export async function POST() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncBreezeEvents();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
