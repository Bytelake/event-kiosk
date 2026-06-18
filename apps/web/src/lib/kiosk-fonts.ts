export type KioskFontScheme = {
  kioskPrimaryFont: string;
  kioskSecondaryFont: string;
};

export const defaultKioskFonts: KioskFontScheme = {
  kioskPrimaryFont: "Playfair Display",
  kioskSecondaryFont: "DM Sans",
};

/** Headings / display fonts — presets for the primary font picker. */
export const KIOSK_PRIMARY_FONT_PRESETS = [
  { label: "Playfair Display", family: "Playfair Display" },
  { label: "Merriweather", family: "Merriweather" },
  { label: "Lora", family: "Lora" },
  { label: "Libre Baskerville", family: "Libre Baskerville" },
  { label: "Fraunces", family: "Fraunces" },
  { label: "Cormorant Garamond", family: "Cormorant Garamond" },
  { label: "Oswald", family: "Oswald" },
  { label: "Montserrat", family: "Montserrat" },
] as const;

/** UI / body fonts — sans-serif presets for the secondary font picker. */
export const KIOSK_SECONDARY_FONT_PRESETS = [
  { label: "DM Sans", family: "DM Sans" },
  { label: "Inter", family: "Inter" },
  { label: "Open Sans", family: "Open Sans" },
  { label: "Roboto", family: "Roboto" },
  { label: "Lato", family: "Lato" },
  { label: "Nunito Sans", family: "Nunito Sans" },
  { label: "Source Sans 3", family: "Source Sans 3" },
  { label: "Work Sans", family: "Work Sans" },
] as const;

export const KIOSK_FONT_CUSTOM_VALUE = "__custom__";

export function resolveKioskFonts(
  partial?: Partial<KioskFontScheme> | null,
): KioskFontScheme {
  return {
    kioskPrimaryFont: partial?.kioskPrimaryFont ?? defaultKioskFonts.kioskPrimaryFont,
    kioskSecondaryFont:
      partial?.kioskSecondaryFont ?? defaultKioskFonts.kioskSecondaryFont,
  };
}

export function googleFontFamilyParam(family: string): string {
  return family.trim().replace(/\s+/g, "+");
}

export function googleFontsStylesheetUrl(primary: string, secondary: string): string {
  const families = [...new Set([primary.trim(), secondary.trim()])];
  const params = families
    .map((family) => `family=${googleFontFamilyParam(family)}:wght@400;500;600;700;900`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

function fontFamilyCss(family: string, kind: "sans" | "serif"): string {
  const fallback =
    kind === "sans" ? "system-ui, sans-serif" : 'Georgia, "Times New Roman", serif';
  return `"${family.trim()}", ${fallback}`;
}

export function kioskFontStyle(fonts: KioskFontScheme): Record<string, string> {
  return {
    "--font-kiosk-display": fontFamilyCss(fonts.kioskPrimaryFont, "serif"),
    "--font-kiosk-ui": fontFamilyCss(fonts.kioskSecondaryFont, "sans"),
  };
}

const KIOSK_FONTS_LINK_ID = "kiosk-google-fonts";

export function applyKioskFonts(fonts: KioskFontScheme): void {
  if (typeof document === "undefined") return;

  const href = googleFontsStylesheetUrl(
    fonts.kioskPrimaryFont,
    fonts.kioskSecondaryFont,
  );

  let link = document.getElementById(KIOSK_FONTS_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = KIOSK_FONTS_LINK_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== href) {
    link.href = href;
  }

  const root = document.querySelector(".kiosk-root") as HTMLElement | null;
  if (root) {
    const style = kioskFontStyle(fonts);
    for (const [key, value] of Object.entries(style)) {
      root.style.setProperty(key, value);
    }
  }
}

export function ensureGoogleFontsPreviewLink(
  linkId: string,
  primary: string,
  secondary: string,
): void {
  if (typeof document === "undefined") return;

  const href = googleFontsStylesheetUrl(primary, secondary);
  let link = document.getElementById(linkId) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== href) {
    link.href = href;
  }
}
