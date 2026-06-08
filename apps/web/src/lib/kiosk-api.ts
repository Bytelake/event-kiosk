import { defaultKioskColorScheme, type KioskColorScheme } from "@/lib/kiosk-colors";

export interface KioskEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  shortDescription: string | null;
  fullDescription: string | null;
  location: string | null;
  imageUrl: string | null;
  registrationUrl: string | null;
  featured: boolean;
}

export type KioskSettings = KioskColorScheme & {
  orgName: string;
  orgLogoUrl: string | null;
};

export async function fetchKioskEvents(): Promise<KioskEvent[]> {
  const res = await fetch("/api/events?kiosk=true", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load events");
  return res.json();
}

export async function fetchPublicSettings(): Promise<KioskSettings> {
  const res = await fetch("/api/settings", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load settings");
  const data = await res.json();
  return {
    orgName: data.orgName,
    orgLogoUrl: data.orgLogoUrl,
    ...defaultKioskColorScheme,
    brandPrimaryColor: data.brandPrimaryColor ?? defaultKioskColorScheme.brandPrimaryColor,
    brandSecondaryColor: data.brandSecondaryColor ?? defaultKioskColorScheme.brandSecondaryColor,
    kioskBackgroundColor: data.kioskBackgroundColor ?? defaultKioskColorScheme.kioskBackgroundColor,
    kioskTextColor: data.kioskTextColor ?? defaultKioskColorScheme.kioskTextColor,
    kioskMutedTextColor: data.kioskMutedTextColor ?? defaultKioskColorScheme.kioskMutedTextColor,
  };
}
