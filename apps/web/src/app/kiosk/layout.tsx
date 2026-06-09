import type { Metadata } from "next";
import { KioskShell } from "@/components/kiosk/kiosk-shell";

export const metadata: Metadata = {
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <KioskShell>{children}</KioskShell>;
}
