import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { KioskShell } from "@/components/kiosk/kiosk-shell";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-kiosk-display",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-kiosk-ui",
});

export const metadata: Metadata = {
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${playfairDisplay.variable} ${dmSans.variable} kiosk-root`}>
      <KioskShell>{children}</KioskShell>
    </div>
  );
}
