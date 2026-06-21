export const GITHUB_REPO = "Bytelake/event-kiosk";

export function getKioskVersion(): string {
  return process.env.KIOSK_APP_VERSION ?? "0.0.0";
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
