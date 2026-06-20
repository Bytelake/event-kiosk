"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useKioskRefresh } from "@/components/kiosk/use-kiosk-refresh";
import { useIdleTimeout } from "@/components/kiosk/use-idle-timeout";
import { KioskBackground } from "@/components/kiosk/kiosk-background";
import type { KioskSettings } from "@/lib/kiosk-api";
import { defaultKioskColorScheme } from "@/lib/kiosk-colors";
import { defaultKioskBackgroundStyle } from "@/lib/kiosk-background";
import { applyKioskFonts } from "@/lib/kiosk-fonts";
import { isDesktopMode } from "@/lib/kiosk-mode";
import { closeRegistration } from "@/lib/kiosk-shell";
import { cn } from "@/lib/utils";

export function KioskShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [settings, setSettings] = useState<KioskSettings | null>(null);

  useKioskRefresh({ onSettings: setSettings });

  useEffect(() => {
    if (!settings) return;
    applyKioskFonts({
      kioskPrimaryFont: settings.kioskPrimaryFont,
      kioskSecondaryFont: settings.kioskSecondaryFont,
    });
  }, [settings?.kioskPrimaryFont, settings?.kioskSecondaryFont, settings]);

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
        "min-h-screen",
        !isDesktopMode() && "cursor-none [&_*]:cursor-none",
      )}
    >
      <KioskBackground
        colors={settings ?? defaultKioskColorScheme}
        style={settings?.kioskBackgroundStyle ?? defaultKioskBackgroundStyle}
        imageUrl={settings?.kioskBackgroundImageUrl}
        animated={settings?.kioskBackgroundAnimated ?? true}
      >
        {children}
      </KioskBackground>
    </div>
  );
}
