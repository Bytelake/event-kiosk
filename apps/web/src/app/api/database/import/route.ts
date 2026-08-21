import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import {
  DatabaseBackupError,
  importDatabaseFile,
  isSqliteFile,
  removeTempDatabaseFile,
  writeTempDatabaseFile,
} from "@/lib/database-backup";
import { DatabaseUnavailableError } from "@/lib/database-maintenance";
import {
  extractFullBackup,
  isZipFile,
  removeFullBackupTempDir,
  restoreUploadsFromBackup,
} from "@/lib/full-backup";
import { pruneUnreferencedUploads } from "@/lib/upload-cleanup";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  let tempPath: string | null = null;
  let fullBackupTempDir: string | null = null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    if (isZipFile(buffer)) {
      const extracted = await extractFullBackup(buffer);
      fullBackupTempDir = extracted.tempDir;
      tempPath = extracted.dbPath;

      const result = await importDatabaseFile(tempPath);
      const restoredUploadCount = extracted.uploadsDir
        ? await restoreUploadsFromBackup(extracted.uploadsDir)
        : 0;
      const prunedUploadCount = await pruneUnreferencedUploads();

      return NextResponse.json({
        ok: true,
        eventCount: result.eventCount,
        domainCount: result.domainCount,
        restoredUploadCount,
        prunedUploadCount,
      });
    }

    if (!isSqliteFile(buffer)) {
      return NextResponse.json(
        { error: "File must be a kiosk backup archive (.zip) or SQLite database (.db)" },
        { status: 400 },
      );
    }

    tempPath = await writeTempDatabaseFile(buffer);
    const result = await importDatabaseFile(tempPath);
    const prunedUploadCount = await pruneUnreferencedUploads();

    return NextResponse.json({
      ok: true,
      eventCount: result.eventCount,
      domainCount: result.domainCount,
      restoredUploadCount: 0,
      prunedUploadCount,
    });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof DatabaseBackupError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[database/import]", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  } finally {
    if (fullBackupTempDir) {
      await removeFullBackupTempDir(fullBackupTempDir);
    } else if (tempPath) {
      await removeTempDatabaseFile(tempPath);
    }
  }
}
