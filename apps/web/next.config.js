const rootPackage = require("../../package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    KIOSK_APP_VERSION: rootPackage.version,
    NEXT_PUBLIC_KIOSK_DESKTOP_MODE:
      process.env.KIOSK_DESKTOP_MODE === "true" ? "true" : "false",
  },
  experimental: {
    // Don't bundle Prisma — install native binaries on the target host during setup
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

module.exports = nextConfig;
