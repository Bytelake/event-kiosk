import { cn } from "@/lib/utils";
import { kioskColorSchemeStyle, type KioskColorScheme } from "@/lib/kiosk-colors";

/** Soft color washes — CSS radial gradients only (no filter: blur). */
const STABLE_ORBS = [
  "kiosk-orb-stable kiosk-orb-stable-1",
  "kiosk-orb-stable kiosk-orb-stable-2",
  "kiosk-orb-stable kiosk-orb-stable-3",
] as const;

/** Rich tier only: animated blurred orbs (hidden unless html.kiosk-graphics-rich). */
const RICH_ORBS = [
  "kiosk-orb-rich kiosk-orb-rich-1 kiosk-orb-drift-1",
  "kiosk-orb-rich kiosk-orb-rich-2 kiosk-orb-drift-2",
  "kiosk-orb-rich kiosk-orb-rich-3 kiosk-orb-drift-3",
] as const;

export function KioskBackground({
  colors,
  children,
}: {
  colors: Partial<KioskColorScheme>;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("kiosk-bg relative min-h-screen overflow-hidden")}
      style={kioskColorSchemeStyle(colors)}
    >
      <div aria-hidden className="kiosk-ambient-layer">
        <div className="kiosk-aurora absolute inset-0" />
        <div className="kiosk-mesh-overlay absolute inset-0" />
        {STABLE_ORBS.map((className) => (
          <div key={className} className={cn("absolute inset-0", className)} />
        ))}
        {RICH_ORBS.map((className) => (
          <div key={className} className={className} />
        ))}
        <div className="kiosk-vignette absolute inset-0" />
      </div>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
