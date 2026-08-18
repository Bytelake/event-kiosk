import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { applyScheduledDisplayPower, readDisplayHardwareStatus } from "@/lib/display-power";
import { desiredDisplayOn } from "@/lib/display-schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  const hardware = await readDisplayHardwareStatus();

  return NextResponse.json({
    desiredOn: desiredDisplayOn(settings),
    hardwareOn: hardware.on,
    available: hardware.available,
    method: hardware.method,
    error: hardware.error,
  });
}

export async function POST() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  const applied = await applyScheduledDisplayPower(settings);

  return NextResponse.json({
    desiredOn: desiredDisplayOn(settings),
    hardwareOn: applied.on,
    available: applied.available,
    method: applied.method,
    error: applied.error,
  });
}
