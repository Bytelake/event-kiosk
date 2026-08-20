import fs from "fs";
import path from "path";

export const DEFAULT_SQLITE_URL = "file:./dev.db";

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "").trim();
}

/** Directory that contains schema.prisma (`apps/web/prisma`). */
export function getPrismaSchemaDir(cwd = process.cwd()): string {
  const candidates = [
    path.join(cwd, "prisma", "schema.prisma"),
    path.join(cwd, "apps/web/prisma", "schema.prisma"),
  ];
  for (const schemaPath of candidates) {
    if (fs.existsSync(schemaPath)) {
      return path.dirname(schemaPath);
    }
  }
  return path.join(cwd, "prisma");
}

function isLegacyDevDbPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return normalized === "dev.db" || normalized === "prisma/dev.db";
}

/**
 * Resolve DATABASE_URL to an absolute `file:` URL.
 *
 * Prisma 5 stored `file:./dev.db` next to schema.prisma (`apps/web/prisma/dev.db`).
 * Prisma 7 resolves that same URL relative to `prisma.config.ts` (`apps/web/dev.db`),
 * which created a second empty database on `npm run dev`. Keep the historical file.
 * Absolute production URLs (`file:/var/lib/kiosk/kiosk.db`) are unchanged.
 */
export function resolveDatabaseUrl(
  url = process.env.DATABASE_URL,
  cwd = process.cwd(),
): string {
  const raw = stripQuotes(url ?? DEFAULT_SQLITE_URL);
  const withoutScheme = raw.replace(/^file:/, "");

  if (path.isAbsolute(withoutScheme)) {
    return `file:${withoutScheme}`;
  }

  const relative = withoutScheme.replace(/^\.\//, "");
  const filePath = isLegacyDevDbPath(relative)
    ? path.join(getPrismaSchemaDir(cwd), "dev.db")
    : path.resolve(cwd, relative);
  return `file:${filePath}`;
}

/** Resolve the SQLite file path from DATABASE_URL. */
export function getDatabaseFilePath(): string {
  return resolveDatabaseUrl().replace(/^file:/, "");
}

export function backupFilename(date = new Date()): string {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  return `kiosk-backup-${stamp}.db`;
}
