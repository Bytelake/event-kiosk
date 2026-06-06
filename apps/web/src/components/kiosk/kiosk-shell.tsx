"use client";

import { useKioskRefresh } from "@/components/kiosk/use-kiosk-refresh";

export function KioskShell({ children }: { children: React.ReactNode }) {
  useKioskRefresh();

  return (
    <div className="kiosk-root min-h-screen cursor-none [&_*]:cursor-none">{children}</div>
  );
}
