import type { Metadata } from "next";
import { getSettings } from "@/lib/db";
import { KioskShell } from "@/components/kiosk/kiosk-shell";
import {
  googleFontsStylesheetUrl,
  kioskFontStyle,
  resolveKioskFonts,
} from "@/lib/kiosk-fonts";

export const metadata: Metadata = {
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const fonts = resolveKioskFonts(settings);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        id="kiosk-google-fonts"
        rel="stylesheet"
        href={googleFontsStylesheetUrl(fonts.kioskPrimaryFont, fonts.kioskSecondaryFont)}
      />
      <div className="kiosk-root" style={kioskFontStyle(fonts)}>
        <KioskShell>{children}</KioskShell>
      </div>
    </>
  );
}
