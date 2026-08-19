import { defaultKioskColorScheme, type KioskColorScheme } from "@/lib/kiosk-colors";
import {
  defaultKioskBackgroundStyle,
  type KioskBackgroundStyle,
} from "@/lib/kiosk-background";
import { defaultKioskFonts, type KioskFontScheme } from "@/lib/kiosk-fonts";

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
  urlLabel?: string | null;
  featured: boolean;
}

export type KioskSettings = KioskColorScheme &
  KioskFontScheme & {
    orgName: string;
    orgLogoUrl: string | null;
    kioskShowLogo: boolean;
    kioskShowOrgName: boolean;
    kioskIdleTimeoutSeconds: number;
    kioskBackgroundAnimated: boolean;
    kioskBackgroundStyle: KioskBackgroundStyle;
    kioskBackgroundImageUrl: string | null;
  };

/** In-memory cache so kiosk home can render instantly when navigating back. */
let cachedKioskEvents: KioskEvent[] | null = null;
let cachedKioskSettings: KioskSettings | null = null;

export function getCachedKioskEvents(): KioskEvent[] | null {
  return cachedKioskEvents;
}

export function getCachedKioskSettings(): KioskSettings | null {
  return cachedKioskSettings;
}

export async function fetchKioskEvents(): Promise<KioskEvent[]> {
  const res = await fetch("/api/events?kiosk=true", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load events");
  const events = (await res.json()) as KioskEvent[];
  cachedKioskEvents = events;
  return events;
}

export async function fetchKioskEvent(id: string): Promise<KioskEvent | null> {
  const res = await fetch(`/api/events/${id}?kiosk=true`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load event");
  return res.json();
}

export function parsePublicSettings(data: {
  orgName: string;
  orgLogoUrl?: string | null;
  kioskShowLogo?: boolean;
  kioskShowOrgName?: boolean;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  kioskBackgroundColor?: string;
  kioskTextColor?: string;
  kioskMutedTextColor?: string;
  kioskPrimaryFont?: string;
  kioskSecondaryFont?: string;
  kioskIdleTimeoutSeconds?: number;
  kioskBackgroundAnimated?: boolean;
  kioskBackgroundStyle?: KioskBackgroundStyle;
  kioskBackgroundImageUrl?: string | null;
}): KioskSettings {
  return {
    orgName: data.orgName,
    orgLogoUrl: data.orgLogoUrl ?? null,
    kioskShowLogo: data.kioskShowLogo ?? true,
    kioskShowOrgName: data.kioskShowOrgName ?? true,
    ...defaultKioskColorScheme,
    ...defaultKioskFonts,
    brandPrimaryColor: data.brandPrimaryColor ?? defaultKioskColorScheme.brandPrimaryColor,
    brandSecondaryColor: data.brandSecondaryColor ?? defaultKioskColorScheme.brandSecondaryColor,
    kioskBackgroundColor: data.kioskBackgroundColor ?? defaultKioskColorScheme.kioskBackgroundColor,
    kioskTextColor: data.kioskTextColor ?? defaultKioskColorScheme.kioskTextColor,
    kioskMutedTextColor: data.kioskMutedTextColor ?? defaultKioskColorScheme.kioskMutedTextColor,
    kioskPrimaryFont: data.kioskPrimaryFont ?? defaultKioskFonts.kioskPrimaryFont,
    kioskSecondaryFont: data.kioskSecondaryFont ?? defaultKioskFonts.kioskSecondaryFont,
    kioskIdleTimeoutSeconds: data.kioskIdleTimeoutSeconds ?? 60,
    kioskBackgroundAnimated: data.kioskBackgroundAnimated ?? true,
    kioskBackgroundStyle: data.kioskBackgroundStyle ?? defaultKioskBackgroundStyle,
    kioskBackgroundImageUrl: data.kioskBackgroundImageUrl ?? null,
  };
}

export async function fetchPublicSettings(): Promise<KioskSettings> {
  const res = await fetch("/api/settings", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load settings");
  const settings = parsePublicSettings(await res.json());
  cachedKioskSettings = settings;
  return settings;
}
