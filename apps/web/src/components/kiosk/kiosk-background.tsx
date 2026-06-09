import { cn } from "@/lib/utils";
import { kioskColorSchemeStyle, type KioskColorScheme } from "@/lib/kiosk-colors";

export function KioskBackground({
  colors,
  children,
}: {
  colors: Partial<KioskColorScheme>;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("kiosk-bg relative min-h-screen")}
      style={kioskColorSchemeStyle(colors)}
    >
      {children}
    </div>
  );
}
