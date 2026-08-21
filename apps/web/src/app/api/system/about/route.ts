import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { checkLatestRelease } from "@/lib/github-release";
import { getSystemSpecs } from "@/lib/system-metrics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const forceReleaseCheck = new URL(request.url).searchParams.get("refresh") === "1";
  const [specs, release] = await Promise.all([
    getSystemSpecs(),
    checkLatestRelease(forceReleaseCheck),
  ]);

  return NextResponse.json({ specs, release });
}
