"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Mail, Heart, type LucideIcon } from "lucide-react";
import {
  fetchPublicSettings,
  getCachedKioskSettings,
  type KioskSettings,
} from "@/lib/kiosk-api";
import {
  getKioskDestinations,
  type KioskDestination,
  type KioskDestinationId,
} from "@/lib/kiosk-destinations";
import { preloadImageUrls } from "@/lib/preload-images";

const destinationIcons: Record<KioskDestinationId, LucideIcon> = {
  events: Calendar,
  newsletter: Mail,
  give: Heart,
};

const destinationDescriptions: Record<KioskDestinationId, string> = {
  events: "Browse upcoming events and sign up",
  newsletter: "Stay connected with our community",
  give: "Learn how you can support our mission",
};

function destinationDescription(destination: KioskDestination, settings: KioskSettings): string {
  if (destination.id === "newsletter") {
    return settings.newsletterBody;
  }
  if (destination.id === "give") {
    return settings.givingBody;
  }
  return destinationDescriptions.events;
}

export function KioskHub() {
  const [settings, setSettings] = useState<KioskSettings | null>(
    () => getCachedKioskSettings(),
  );

  useEffect(() => {
    fetchPublicSettings()
      .then((data) => {
        setSettings(data);
        preloadImageUrls([data.orgLogoUrl, data.kioskBackgroundImageUrl]);
      })
      .catch(() => {
        /* keep cached settings if available */
      });
  }, []);

  const destinations = settings ? getKioskDestinations(settings) : [];

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
      <header className="mb-10 flex flex-col items-center text-center">
        {settings?.kioskShowLogo && settings.orgLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.orgLogoUrl}
            alt={settings.orgName}
            className="mb-4 h-24 w-auto object-contain"
          />
        ) : null}
        {settings?.kioskShowOrgName && (
          <p className="kiosk-on-bg kiosk-on-bg-muted mb-1 text-base tracking-wide">
            {settings.orgName ?? "Welcome"}
          </p>
        )}
        <h1 className="kiosk-on-bg kiosk-on-bg-text kiosk-display text-[clamp(2.25rem,5vw,3.5rem)] font-black leading-tight">
          Welcome
        </h1>
        <p className="kiosk-on-bg kiosk-on-bg-muted mt-2 text-lg">Choose where you would like to go</p>
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {destinations.map((destination) => {
          const Icon = destinationIcons[destination.id];
          const description = settings
            ? destinationDescription(destination, settings)
            : destinationDescriptions[destination.id];

          return (
            <Link
              key={destination.id}
              href={destination.href}
              className="kiosk-glass group flex min-h-[220px] flex-col justify-between rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition active:scale-[0.985]"
            >
              <div
                className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--brand) 0%, var(--brand-secondary) 100%)",
                  boxShadow: "0 8px 24px var(--kiosk-brand-glow)",
                }}
              >
                <Icon className="h-7 w-7" aria-hidden />
              </div>
              <div>
                <h2 className="kiosk-display mb-2 text-[clamp(1.5rem,3vw,2rem)] font-bold text-[var(--kiosk-text)]">
                  {destination.label}
                </h2>
                <p className="text-base leading-snug text-[color-mix(in_srgb,var(--kiosk-text)_75%,transparent)]">
                  {description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
