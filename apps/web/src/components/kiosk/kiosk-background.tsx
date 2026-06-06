import { cn } from "@/lib/utils";
import type { KioskBackgroundStyle } from "@/lib/kiosk-api";

const styleClasses: Record<KioskBackgroundStyle, string> = {
  clean: "kiosk-bg-clean",
  "brand-glow": "kiosk-bg-brand-glow",
  dots: "kiosk-bg-dots",
  aurora: "kiosk-bg-aurora",
};

export function KioskBackground({
  style,
  brandColor,
  children,
}: {
  style: KioskBackgroundStyle;
  brandColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("relative min-h-screen", styleClasses[style])}
      style={{ ["--brand" as string]: brandColor }}
    >
      {children}
    </div>
  );
}
