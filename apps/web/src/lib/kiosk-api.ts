export interface KioskEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  location: string | null;
  imageUrl: string | null;
  registrationUrl: string | null;
  featured: boolean;
}

export interface KioskSettings {
  orgName: string;
  orgLogoUrl: string | null;
  brandPrimaryColor: string;
}

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
    brandPrimaryColor: data.brandPrimaryColor,
  };
}
