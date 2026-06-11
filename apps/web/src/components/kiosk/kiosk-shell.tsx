"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useKioskRefresh } from "@/components/kiosk/use-kiosk-refresh";
import { useIdleTimeout } from "@/components/kiosk/use-idle-timeout";
import { KioskBackground } from "@/components/kiosk/kiosk-background";
import { fetchPublicSettings, type KioskSettings } from "@/lib/kiosk-api";
import { defaultKioskColorScheme } from "@/lib/kiosk-colors";
import { isDesktopMode } from "@/lib/kiosk-mode";
import { closeRegistration } from "@/lib/kiosk-shell";
import { cn } from "@/lib/utils";

export function KioskShell({ children }: { children: React.ReactNode }) {
  useKioskRefresh();
  const router = useRouter();
  const [settings, setSettings] = useState<KioskSettings | null>(null);

  const handleIdleTimeout = useCallback(() => {
    closeRegistration();
    router.push("/kiosk");
  }, [router]);

  const idleTimeoutMs =
    isDesktopMode() || !settings || settings.kioskIdleTimeoutSeconds <= 0
      ? null
      : settings.kioskIdleTimeoutSeconds * 1000;

  useIdleTimeout(handleIdleTimeout, idleTimeoutMs);

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
