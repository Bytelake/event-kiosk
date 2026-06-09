import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

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
