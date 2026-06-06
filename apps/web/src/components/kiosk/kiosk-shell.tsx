"use client";

import { useEffect, useState } from "react";
import { useKioskRefresh } from "@/components/kiosk/use-kiosk-refresh";
import { KioskBackground } from "@/components/kiosk/kiosk-background";
import { fetchPublicSettings, type KioskSettings } from "@/lib/kiosk-api";

export function KioskShell({ children }: { children: React.ReactNode }) {
  useKioskRefresh();
  const [settings, setSettings] = useState<KioskSettings | null>(null);

  useEffect(() => {
    fetchPublicSettings()
      .then(setSettings)
      .catch(() => {});

    const interval = setInterval(() => {
      fetchPublicSettings()
        .then(setSettings)
        .catch(() => {});
    }, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="kiosk-root min-h-screen cursor-none [&_*]:cursor-none">
      <KioskBackground
        style={settings?.kioskBackgroundStyle ?? "clean"}
        brandColor={settings?.brandPrimaryColor ?? "#2563eb"}
      >
        {children}
      </KioskBackground>
    </div>
  );
}
