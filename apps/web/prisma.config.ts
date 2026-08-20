import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./src/lib/database-path";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
