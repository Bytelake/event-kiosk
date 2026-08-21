import { normalizeRegistrationUrl } from "@/lib/registration-domains";

/** Max gap between keystrokes before the wedge buffer resets (human typing vs scanner). */
export const QR_SCAN_CHAR_GAP_MS = 80;

/** After the last character, commit if the buffer looks like a URL (scanners without Enter). */
export const QR_SCAN_IDLE_COMMIT_MS = 250;

/**
 * Parse a keyboard-wedge scan into an https URL.
 * Accepts any hostname; rejects non-http(s) schemes.
 */
export function parseScannedQrUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = normalizeRegistrationUrl(trimmed);
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isPrintableScanKey(key: string): boolean {
  return key.length === 1 && key !== "\x00";
}
