"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useKioskRefresh } from "@/components/kiosk/use-kiosk-refresh";
import { useIdleTimeout } from "@/components/kiosk/use-idle-timeout";
import { KioskBackground } from "@/components/kiosk/kiosk-background";
import type { KioskSettings } from "@/lib/kiosk-api";
import { defaultKioskColorScheme } from "@/lib/kiosk-colors";
import { isDesktopMode } from "@/lib/kiosk-mode";
import { closeRegistration } from "@/lib/kiosk-shell";
import { cn } from "@/lib/utils";

export function KioskShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [settings, setSettings] = useState<KioskSettings | null>(null);

  useKioskRefresh({ onSettings: setSettings });

  const handleIdleTimeout = useCallback(() => {
    closeRegistration();
    router.push("/kiosk");
  }, [router]);

  const idleTimeoutMs =
    !settings || settings.kioskIdleTimeoutSeconds <= 0
      ? null
      : settings.kioskIdleTimeoutSeconds * 1000;

  useIdleTimeout(handleIdleTimeout, idleTimeoutMs);

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
