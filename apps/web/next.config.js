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
  poweredByHeader: false,
  env: {
    KIOSK_APP_VERSION: resolveKioskAppVersion(),
    NEXT_PUBLIC_KIOSK_DESKTOP_MODE:
      process.env.KIOSK_DESKTOP_MODE === "true" ? "true" : "false",
  },
  serverExternalPackages: ["@prisma/client", "sharp"],
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
