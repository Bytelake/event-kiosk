import type { KioskSettings } from "@/lib/kiosk-api";

export type KioskDestinationId = "events" | "newsletter" | "give";

export interface KioskDestination {
  id: KioskDestinationId;
  href: string;
  label: string;
  enabled: boolean;
}

/** Build the ordered list of kiosk destinations from public settings. */
export function getKioskDestinations(settings: KioskSettings): KioskDestination[] {
  const destinations: KioskDestination[] = [
    {
      id: "events",
      href: "/kiosk/events",
      label: "Events",
      enabled: true,
    },
    {
      id: "newsletter",
      href: "/kiosk/newsletter",
      label: settings.newsletterTitle,
      enabled: settings.newsletterEnabled && settings.newsletterUrl.trim().length > 0,
    },
    {
      id: "give",
      href: "/kiosk/give",
      label: settings.givingTitle,
      enabled: settings.givingEnabled,
    },
  ];

  return destinations.filter((destination) => destination.enabled);
}
