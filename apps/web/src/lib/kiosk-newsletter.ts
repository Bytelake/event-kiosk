import type { KioskSettings } from "@/lib/kiosk-api";
import { openRegistration } from "@/lib/kiosk-shell";

export function isNewsletterAvailable(
  settings: Pick<KioskSettings, "newsletterEnabled" | "newsletterUrl">,
) {
  return settings.newsletterEnabled && settings.newsletterUrl.trim().length > 0;
}

export function openNewsletterRegistration(
  settings: Pick<KioskSettings, "newsletterEnabled" | "newsletterUrl">,
) {
  if (!isNewsletterAvailable(settings)) return false;
  openRegistration(settings.newsletterUrl);
  return true;
}
