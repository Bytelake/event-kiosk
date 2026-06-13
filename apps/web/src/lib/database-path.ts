import path from "path";

/** Resolve the SQLite file path from DATABASE_URL (same rules as Prisma). */
export function getDatabaseFilePath(): string {
  const url = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^["']|["']$/g, "");
  let filePath = url.replace(/^file:/, "");

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  const relative = filePath.replace(/^\.\//, "");
  return path.join(process.cwd(), "prisma", relative);
}

export function backupFilename(date = new Date()): string {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  return `kiosk-backup-${stamp}.db`;
}
