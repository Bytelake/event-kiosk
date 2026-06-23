import fs from "fs";
import path from "path";

export const GITHUB_REPO = "Bytelake/event-kiosk";

const VERSION_FILE_RELATIVE_PATHS = [
  ".kiosk-package-version",
  "apps/web/.kiosk-package-version",
];

function readPackageVersionFile(): string | null {
  for (const rel of VERSION_FILE_RELATIVE_PATHS) {
    try {
      const value = fs.readFileSync(path.join(process.cwd(), rel), "utf8").trim();
      if (value) {
        return value;
      }
    } catch {
      // optional file — only present in packaged installs
    }
  }

  return null;
}

export function getKioskVersion(): string {
  return readPackageVersionFile() ?? process.env.KIOSK_APP_VERSION ?? "0.0.0";
}

/** Compare numeric semver segments; ignores pre-release suffixes. */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (value: string) =>
    value
      .replace(/^v/i, "")
      .split("-")[0]
      .split(".")
      .map((part) => parseInt(part, 10) || 0);

  const a = parse(latest);
  const b = parse(current);
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) {
      return diff > 0;
    }
  }

  return false;
}
