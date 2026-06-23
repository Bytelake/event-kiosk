import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { checkLatestRelease } from "@/lib/github-release";
import { getSystemSpecs } from "@/lib/system-metrics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forceReleaseCheck = new URL(request.url).searchParams.get("refresh") === "1";
  const [specs, release] = await Promise.all([
    getSystemSpecs(),
    checkLatestRelease(forceReleaseCheck),
  ]);

  return NextResponse.json({ specs, release });
}
