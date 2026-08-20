import { strToU8, unzipSync, zipSync } from "fflate";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { DatabaseBackupError, isSqliteFile, validateKioskDatabaseFile } from "@/lib/database-backup";
import { backupFilename, getDatabaseFilePath } from "@/lib/database-path";
import { detectImageFormat } from "@/lib/upload-validation";
import { getUploadsDir, listUploadFilenames } from "@/lib/uploads";

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_DB_ENTRY = "kiosk.db";
export const BACKUP_MANIFEST_ENTRY = "manifest.json";
export const BACKUP_UPLOADS_DIR = "uploads";
export const MAX_FULL_BACKUP_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_BACKUP_ENTRIES = 4_000;
const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024;

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export interface BackupManifest {
  version: number;
  exportedAt: string;
  database: string;
  uploadCount: number;
}

export function isZipFile(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(ZIP_MAGIC);
}

export function fullBackupFilename(date = new Date()): string {
  return backupFilename(date).replace(/\.db$/, ".zip");
}

function resolveSafeEntryPath(destDir: string, entryPath: string): string {
  const normalized = entryPath.replace(/\\/g, "/");
  if (path.isAbsolute(normalized) || normalized.includes("..")) {
    throw new DatabaseBackupError("Invalid backup: unsafe path in archive");
  }

  const targetPath = path.resolve(destDir, normalized);
  const resolvedDest = path.resolve(destDir);
  if (targetPath !== resolvedDest && !targetPath.startsWith(`${resolvedDest}${path.sep}`)) {
    throw new DatabaseBackupError("Invalid backup: unsafe path in archive");
  }

  return targetPath;
}

export async function createFullBackupBuffer(): Promise<Buffer> {
  const dbPath = getDatabaseFilePath();
  const uploadsDir = getUploadsDir();

  try {
    await stat(dbPath);
  } catch {
    throw new DatabaseBackupError("Database file not found");
  }

  const uploadFilenames = await listUploadFilenames();
  const manifest: BackupManifest = {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    database: BACKUP_DB_ENTRY,
    uploadCount: uploadFilenames.length,
  };

  const archiveEntries: Record<string, Uint8Array> = {
    [BACKUP_MANIFEST_ENTRY]: strToU8(JSON.stringify(manifest, null, 2)),
    [BACKUP_DB_ENTRY]: new Uint8Array(await readFile(dbPath)),
  };

  for (const filename of uploadFilenames) {
    const filePath = path.join(uploadsDir, filename);
    archiveEntries[`${BACKUP_UPLOADS_DIR}/${filename}`] = new Uint8Array(await readFile(filePath));
  }

  return Buffer.from(zipSync(archiveEntries, { level: 9 }));
}

export async function extractFullBackup(buffer: Buffer): Promise<{
  tempDir: string;
  dbPath: string;
  uploadsDir: string | null;
}> {
  if (buffer.byteLength === 0) {
    throw new DatabaseBackupError("Backup file is empty");
  }
  if (buffer.byteLength > MAX_FULL_BACKUP_BYTES) {
    throw new DatabaseBackupError("Backup file is too large (max 2 GB)");
  }
  if (!isZipFile(buffer)) {
    throw new DatabaseBackupError("File is not a backup archive");
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "kiosk-backup-import-"));
  let uncompressedBytes = 0;
  let entryCount = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(buffer), {
      filter(file) {
        entryCount += 1;
        if (entryCount > MAX_BACKUP_ENTRIES) {
          throw new DatabaseBackupError("Invalid backup: too many files in archive");
        }

        const size = file.originalSize || 0;
        if (size > MAX_BACKUP_FILE_BYTES) {
          throw new DatabaseBackupError("Invalid backup: a file in the archive is too large");
        }

        uncompressedBytes += size;
        if (uncompressedBytes > MAX_FULL_BACKUP_BYTES) {
          throw new DatabaseBackupError("Invalid backup: uncompressed archive is too large");
        }

        return true;
      },
    });
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    if (error instanceof DatabaseBackupError) throw error;
    throw new DatabaseBackupError("Invalid backup archive");
  }

  for (const [entryPath, content] of Object.entries(entries)) {
    if (content.byteLength > MAX_BACKUP_FILE_BYTES) {
      await rm(tempDir, { recursive: true, force: true });
      throw new DatabaseBackupError("Invalid backup: a file in the archive is too large");
    }
    const targetPath = resolveSafeEntryPath(tempDir, entryPath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content);
  }

  const dbPath = path.join(tempDir, BACKUP_DB_ENTRY);
  try {
    await stat(dbPath);
  } catch {
    await rm(tempDir, { recursive: true, force: true });
    throw new DatabaseBackupError(`Invalid backup: missing "${BACKUP_DB_ENTRY}"`);
  }

  const dbBuffer = await readFile(dbPath);
  if (!isSqliteFile(dbBuffer)) {
    await rm(tempDir, { recursive: true, force: true });
    throw new DatabaseBackupError("Invalid backup: database file is not SQLite");
  }

  await validateKioskDatabaseFile(dbPath);

  const uploadsDir = path.join(tempDir, BACKUP_UPLOADS_DIR);
  let hasUploads = false;
  try {
    const uploadsStat = await stat(uploadsDir);
    hasUploads = uploadsStat.isDirectory();
  } catch {
    hasUploads = false;
  }

  return {
    tempDir,
    dbPath,
    uploadsDir: hasUploads ? uploadsDir : null,
  };
}

export async function restoreUploadsFromBackup(sourceDir: string): Promise<number> {
  const { optimizeUploadedImage } = await import("@/lib/image-optimize");
  const uploadsDir = getUploadsDir();
  await mkdir(uploadsDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  let restored = 0;

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (
      !entry.name ||
      entry.name.includes("..") ||
      entry.name.includes("/") ||
      entry.name.includes("\\")
    ) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(uploadsDir, path.basename(entry.name));
    const fileBuffer = await readFile(sourcePath);
    const detected = detectImageFormat(fileBuffer);
    if (!detected) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    const sourceExt =
      ext === ".jpeg"
        ? ".jpg"
        : ext === ".jpg" || ext === ".png" || ext === ".gif" || ext === ".webp"
          ? ext
          : detected.ext;

    try {
      const optimized = await optimizeUploadedImage(fileBuffer, sourceExt, {
        preserveExt: sourceExt,
      });
      await writeFile(targetPath, optimized.buffer);
    } catch {
      await writeFile(targetPath, fileBuffer);
    }

    restored++;
  }

  return restored;
}

export async function removeFullBackupTempDir(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
}
