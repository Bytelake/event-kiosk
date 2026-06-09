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
  };
}
