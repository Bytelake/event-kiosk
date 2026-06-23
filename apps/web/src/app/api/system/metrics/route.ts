import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSystemMetrics } from "@/lib/system-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metrics = await getSystemMetrics();
  return NextResponse.json(metrics);
}
