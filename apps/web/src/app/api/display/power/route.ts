import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSettings, prisma } from "@/lib/db";
import { applyScheduledDisplayPower, readDisplayHardwareStatus } from "@/lib/display-power";
import { desiredDisplayOn, parseDisplayOnDays } from "@/lib/display-schedule";

export const dynamic = "force-dynamic";

function serializeDisplayPower(
  settings: Awaited<ReturnType<typeof getSettings>>,
  hardware: { on: boolean | null; available: boolean; method: string | null; error: string | null },
) {
  const displaySettings = {
    ...settings,
    kioskDisplayOnDays: parseDisplayOnDays(settings.kioskDisplayOnDays),
  };

  return {
    enabled: settings.kioskDisplayEnabled,
    desiredOn: desiredDisplayOn(displaySettings),
    hardwareOn: hardware.on,
    available: hardware.available,
    method: hardware.method,
    error: hardware.error,
  };
}

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  const hardware = await readDisplayHardwareStatus();
  return NextResponse.json(serializeDisplayPower(settings, hardware));
}

export async function POST(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let enabled: boolean | undefined;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
    if (typeof body.enabled === "boolean") {
      enabled = body.enabled;
    }
  }

  if (enabled !== undefined) {
    await prisma.settings.update({
      where: { id: "default" },
      data: {
        kioskDisplayEnabled: enabled,
        settingsUpdatedAt: new Date(),
      },
    });
  }

  const settings = await getSettings();
  const applied = await applyScheduledDisplayPower(settings);
  return NextResponse.json(serializeDisplayPower(settings, applied));
}
