import { type KioskColorScheme } from "@/lib/kiosk-colors";
import { type KioskFontScheme, kioskFontStyle } from "@/lib/kiosk-fonts";

export function KioskBrandingPreview({
  orgName,
  logoUrl,
  showLogo,
  showOrgName,
  colors,
  fonts,
}: {
  orgName: string;
  logoUrl: string | null;
  showLogo: boolean;
  showOrgName: boolean;
  colors: KioskColorScheme;
  fonts: KioskFontScheme;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
      style={{
        background: `linear-gradient(to bottom, ${colors.kioskBackgroundColor}, #ffffff)`,
        ...kioskFontStyle(fonts),
      }}
    >
      <div className="p-6">
        {showLogo && logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="mb-3 h-10 w-auto object-contain" />
        )}
        {showOrgName && (
          <p
            className="text-sm font-medium"
            style={{
              color: colors.kioskMutedTextColor,
              fontFamily: "var(--font-kiosk-ui)",
            }}
          >
            {orgName || "Organization name"}
          </p>
        )}
        <p
          className="mt-1 text-2xl font-bold"
          style={{
            color: colors.kioskTextColor,
            fontFamily: "var(--font-kiosk-display)",
          }}
        >
          Upcoming Events
        </p>
        <div
          className="mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: colors.brandPrimaryColor }}
        >
          Register
        </div>
        <div
          className="mt-4 h-16 max-w-xs rounded-2xl"
          style={{
            background: `linear-gradient(to bottom right, ${colors.brandPrimaryColor}, ${colors.brandSecondaryColor})`,
          }}
        />
      </div>
    </div>
  );
}
