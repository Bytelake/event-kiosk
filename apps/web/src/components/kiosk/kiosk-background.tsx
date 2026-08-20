"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  defaultKioskBackgroundStyle,
  type KioskBackgroundStyle,
} from "@/lib/kiosk-background";
import { shouldUseLightKioskText } from "@/lib/kiosk-background-luminance";
import { cssImageUrl } from "@/lib/media-url";
import {
  kioskColorSchemeStyle,
  resolveKioskColorScheme,
  type KioskColorScheme,
} from "@/lib/kiosk-colors";

export function KioskBackground({
  colors,
  style = defaultKioskBackgroundStyle,
  imageUrl,
  animated = true,
  children,
}: {
  colors: Partial<KioskColorScheme>;
  style?: KioskBackgroundStyle;
  imageUrl?: string | null;
  animated?: boolean;
  children: React.ReactNode;
}) {
  const photoUrl = cssImageUrl(imageUrl);
  const useImage = style === "image" && Boolean(photoUrl);
  const scheme = resolveKioskColorScheme(colors);
  const [lightText, setLightText] = useState(false);

  useEffect(() => {
    if (!useImage || !imageUrl) {
      setLightText(false);
      return;
    }

    let cancelled = false;

    shouldUseLightKioskText(imageUrl, {
      scrimHex: scheme.brandSecondaryColor,
      textHex: scheme.kioskTextColor,
      mutedTextHex: scheme.kioskMutedTextColor,
    }).then((useLight) => {
      if (!cancelled) setLightText(useLight);
    });

    return () => {
      cancelled = true;
    };
  }, [
    useImage,
    imageUrl,
    scheme.brandSecondaryColor,
    scheme.kioskTextColor,
    scheme.kioskMutedTextColor,
  ]);

  return (
    <div
      className={cn(
        "kiosk-bg relative min-h-screen overflow-hidden",
        useImage ? "kiosk-bg-image" : "kiosk-bg-gradient",
        animated ? "kiosk-bg-animated" : "kiosk-bg-static",
        lightText && "kiosk-bg-light-text",
      )}
      style={kioskColorSchemeStyle(colors)}
    >
      <div aria-hidden className="kiosk-ambient-layer">
        {useImage ? (
          <>
            <div
              className="kiosk-bg-photo"
              style={{ backgroundImage: photoUrl }}
            />
            <div className="kiosk-bg-scrim absolute inset-0" />
          </>
        ) : (
          <>
            <div className="kiosk-bg-aurora absolute inset-0" />
            <div className="kiosk-bg-mesh-overlay absolute inset-0" />
          </>
        )}
      </div>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
