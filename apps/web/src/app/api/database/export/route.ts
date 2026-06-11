import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { backupFilename, getDatabaseFilePath } from "@/lib/database-path";

export const dynamic = "force-dynamic";

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbPath = getDatabaseFilePath();

  try {
    await stat(dbPath);
  } catch {
    return NextResponse.json({ error: "Database file not found" }, { status: 404 });
  }

  const buffer = await readFile(dbPath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Disposition": `attachment; filename="${backupFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
