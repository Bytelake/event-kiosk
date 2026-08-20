import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { DatabaseBackupError } from "@/lib/database-backup";
import { backupFilename, getDatabaseFilePath } from "@/lib/database-path";
import { createFullBackupBuffer, fullBackupFilename } from "@/lib/full-backup";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const format = new URL(request.url).searchParams.get("format");

  if (format === "db") {
    const dbPath = getDatabaseFilePath();

    try {
      await stat(dbPath);
    } catch {
      return NextResponse.json({ error: "Database file not found" }, { status: 404 });
    }

    const buffer = await readFile(dbPath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="${backupFilename()}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format !== null && format !== "full") {
    return NextResponse.json({ error: 'Invalid format. Use "full" or "db".' }, { status: 400 });
  }

  try {
    const buffer = await createFullBackupBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fullBackupFilename()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof DatabaseBackupError) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("[database/export]", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
