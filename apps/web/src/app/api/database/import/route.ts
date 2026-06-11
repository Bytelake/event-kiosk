import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  DatabaseBackupError,
  importDatabaseFile,
  removeTempDatabaseFile,
  writeTempDatabaseFile,
} from "@/lib/database-backup";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  let tempPath: string | null = null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    tempPath = await writeTempDatabaseFile(buffer);
    const result = await importDatabaseFile(tempPath);

    return NextResponse.json({
      ok: true,
      eventCount: result.eventCount,
      domainCount: result.domainCount,
      backupPath: result.backupPath,
    });
  } catch (error) {
    if (error instanceof DatabaseBackupError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[database/import]", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  } finally {
    if (tempPath) {
      await removeTempDatabaseFile(tempPath);
    }
  }
}
