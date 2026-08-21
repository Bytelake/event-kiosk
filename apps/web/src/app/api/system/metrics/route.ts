import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { getSystemMetrics } from "@/lib/system-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const metrics = await getSystemMetrics();
  return NextResponse.json(metrics);
}
