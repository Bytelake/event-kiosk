import { PrismaClient } from "@prisma/client";
import { copyFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { backupFilename, getDatabaseFilePath } from "@/lib/database-path";

const SQLITE_MAGIC = "SQLite format 3\u0000";
const REQUIRED_TABLES = ["Event", "Settings", "AllowedDomain"] as const;
const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export class DatabaseBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseBackupError";
  }
}

export function isSqliteFile(buffer: Buffer): boolean {
  return buffer.subarray(0, 16).toString("utf8") === SQLITE_MAGIC;
}

export async function validateKioskDatabaseFile(filePath: string): Promise<{
  eventCount: number;
  domainCount: number;
}> {
  const client = new PrismaClient({
    datasources: { db: { url: `file:${filePath}` } },
  });

  try {
    const tables = await client.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `;
    const tableNames = new Set(tables.map((row) => row.name));

    for (const table of REQUIRED_TABLES) {
      if (!tableNames.has(table)) {
        throw new DatabaseBackupError(`Invalid backup: missing "${table}" table`);
      }
    }

    const settings = await client.settings.findUnique({ where: { id: "default" } });
    if (!settings) {
      throw new DatabaseBackupError('Invalid backup: missing default settings row');
    }

    const [eventCount, domainCount] = await Promise.all([
      client.event.count(),
      client.allowedDomain.count(),
    ]);

    return { eventCount, domainCount };
  } finally {
    await client.$disconnect();
  }
}

async function removeSqliteSidecars(dbPath: string) {
  for (const suffix of ["-journal", "-wal", "-shm"]) {
    await unlink(`${dbPath}${suffix}`).catch(() => undefined);
  }
}

export async function importDatabaseFile(sourcePath: string): Promise<{
  eventCount: number;
  domainCount: number;
  backupPath: string | null;
}> {
  const stats = await validateKioskDatabaseFile(sourcePath);
  const dbPath = getDatabaseFilePath();
  let backupPath: string | null = null;

  await prisma.$disconnect();

  const preImportName = backupFilename();

  try {
    try {
      backupPath = `${dbPath}.pre-import-${preImportName}`;
      await copyFile(dbPath, backupPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }

    await removeSqliteSidecars(dbPath);
    await copyFile(sourcePath, dbPath);
    await removeSqliteSidecars(dbPath);

    await validateKioskDatabaseFile(dbPath);
    return { ...stats, backupPath };
  } catch (error) {
    if (backupPath) {
      await copyFile(backupPath, dbPath).catch(() => undefined);
      await removeSqliteSidecars(dbPath);
    }
    throw error;
  }
}

export async function writeTempDatabaseFile(buffer: Buffer): Promise<string> {
  if (buffer.byteLength === 0) {
    throw new DatabaseBackupError("Backup file is empty");
  }
  if (buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new DatabaseBackupError("Backup file is too large (max 50 MB)");
  }
  if (!isSqliteFile(buffer)) {
    throw new DatabaseBackupError("File is not a SQLite database");
  }

  const tempPath = path.join(
    path.dirname(getDatabaseFilePath()),
    `.import-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
  await writeFile(tempPath, buffer);
  return tempPath;
}

export async function removeTempDatabaseFile(tempPath: string) {
  await unlink(tempPath).catch(() => undefined);
  await removeSqliteSidecars(tempPath);
}
