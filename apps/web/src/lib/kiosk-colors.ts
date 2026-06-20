export type KioskColorScheme = {
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  kioskBackgroundColor: string;
  kioskTextColor: string;
  kioskMutedTextColor: string;
};

export const defaultKioskColorScheme: KioskColorScheme = {
  brandPrimaryColor: "#2563eb",
  brandSecondaryColor: "#0f172a",
  kioskBackgroundColor: "#f1f5f9",
  kioskTextColor: "#0f172a",
  kioskMutedTextColor: "#64748b",
};

function parseHex(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return [0, 0, 0];
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Mix two hex colors; weight is the fraction of `foreground`. */
export function mixHexColors(foreground: string, background: string, weight: number): string {
  const [r1, g1, b1] = parseHex(foreground);
  const [r2, g2, b2] = parseHex(background);
  const w = Math.min(1, Math.max(0, weight));
  return toHex(r1 * w + r2 * (1 - w), g1 * w + g2 * (1 - w), b1 * w + b2 * (1 - w));
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolveKioskColorScheme(
  partial?: Partial<KioskColorScheme> | null,
): KioskColorScheme {
  return {
    ...defaultKioskColorScheme,
    ...partial,
  };
}

export function kioskColorSchemeStyle(
  partial?: Partial<KioskColorScheme> | null,
): Record<string, string> {
  const scheme = resolveKioskColorScheme(partial);
  return {
    "--brand": scheme.brandPrimaryColor,
    "--brand-secondary": scheme.brandSecondaryColor,
    "--kiosk-bg": scheme.kioskBackgroundColor,
    "--kiosk-text": scheme.kioskTextColor,
    "--kiosk-muted": scheme.kioskMutedTextColor,
    "--kiosk-scrim": hexToRgba(scheme.brandSecondaryColor, 0.55),
    "--kiosk-brand-glow": hexToRgba(scheme.brandPrimaryColor, 0.35),
    "--kiosk-wash-primary": mixHexColors(
      scheme.brandPrimaryColor,
      scheme.kioskBackgroundColor,
      0.3,
    ),
    "--kiosk-wash-primary-light": mixHexColors(scheme.brandPrimaryColor, "#ffffff", 0.22),
    "--kiosk-wash-secondary-bg": mixHexColors(
      scheme.brandSecondaryColor,
      scheme.kioskBackgroundColor,
      0.12,
    ),
    "--kiosk-wash-primary-soft": hexToRgba(scheme.brandPrimaryColor, 0.2),
    "--kiosk-wash-secondary-soft": hexToRgba(scheme.brandSecondaryColor, 0.14),
  };
}
