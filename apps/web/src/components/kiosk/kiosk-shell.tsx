"use client";

import { useEffect, useState } from "react";
import { useKioskRefresh } from "@/components/kiosk/use-kiosk-refresh";
import { KioskBackground } from "@/components/kiosk/kiosk-background";
import { fetchPublicSettings, type KioskSettings } from "@/lib/kiosk-api";
import { defaultKioskColorScheme } from "@/lib/kiosk-colors";
import { isDesktopMode } from "@/lib/kiosk-mode";
import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "kiosk-root min-h-screen",
        !isDesktopMode() && "cursor-none [&_*]:cursor-none",
      )}
    >
      <KioskBackground colors={settings ?? defaultKioskColorScheme}>
        {children}
      </KioskBackground>
    </div>
  );
}
