import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  assertDatabaseWritable,
  trackQueryEnd,
  trackQueryStart,
} from "@/lib/database-maintenance";
import { resolveDatabaseUrl } from "@/lib/database-path";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  // Existing kiosk DBs store DateTime as unix-ms integers. The adapter default
  // (iso8601 text) makes SQL comparisons like `endAt >= $now` match nothing,
  // so the kiosk shows "No upcoming events" while Admin still lists them.
  const adapter = new PrismaBetterSqlite3(
    { url: resolveDatabaseUrl() },
    { timestampFormat: "unixepoch-ms" },
  );

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        assertDatabaseWritable();
        trackQueryStart();
        try {
          return await query(args);
        } finally {
          trackQueryEnd();
        }
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function getSettings() {
  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
  });

  if (settings) return settings;

  return prisma.settings.create({
    data: { id: "default" },
  });
}
