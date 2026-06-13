import { PrismaClient } from "@prisma/client";
import {
  assertDatabaseWritable,
  trackQueryEnd,
  trackQueryStart,
} from "@/lib/database-maintenance";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  const client = new PrismaClient({
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
