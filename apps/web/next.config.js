const fs = require("fs");
const path = require("path");
const rootPackage = require("../../package.json");

function resolveKioskAppVersion() {
  if (process.env.KIOSK_PACKAGE_VERSION) {
    return process.env.KIOSK_PACKAGE_VERSION;
  }

  const versionFile = path.join(__dirname, ".kiosk-package-version");
  try {
    const fromFile = fs.readFileSync(versionFile, "utf8").trim();
    if (fromFile) {
      return fromFile;
    }
  } catch {
    // local dev builds omit the package version file
  }

  return rootPackage.version;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    KIOSK_APP_VERSION: resolveKioskAppVersion(),
    NEXT_PUBLIC_KIOSK_DESKTOP_MODE:
      process.env.KIOSK_DESKTOP_MODE === "true" ? "true" : "false",
  },
  experimental: {
    // Don't bundle Prisma — install native binaries on the target host during setup
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

module.exports = nextConfig;
