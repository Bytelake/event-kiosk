"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Mail, Heart, type LucideIcon } from "lucide-react";
import {
  getKioskDestinations,
  type KioskDestination,
  type KioskDestinationId,
} from "@/lib/kiosk-destinations";
import { useKioskSettings } from "@/components/kiosk/kiosk-settings-context";
import { openRegistration } from "@/lib/kiosk-shell";
import { cn } from "@/lib/utils";

const destinationIcons: Record<KioskDestinationId, LucideIcon> = {
  events: Calendar,
  newsletter: Mail,
  give: Heart,
};

function isDestinationActive(pathname: string, destination: KioskDestination): boolean {
  if (destination.id === "events") {
    return pathname === "/kiosk/events" || pathname.startsWith("/kiosk/events/");
  }

  return pathname === destination.href || pathname.startsWith(`${destination.href}/`);
}

export function KioskNav() {
  const pathname = usePathname();
  const settings = useKioskSettings();
  if (!settings) return null;

  const destinations = getKioskDestinations(settings);
  if (destinations.length <= 1) return null;

  return (
    <nav
      aria-label="Kiosk destinations"
      className="sticky top-0 z-20 border-b border-white/20 bg-white/75 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/60"
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-2">
        <Link
          href="/kiosk"
          className={cn(
            "inline-flex h-12 items-center rounded-2xl px-4 text-sm font-semibold transition active:scale-95",
            pathname === "/kiosk"
              ? "bg-[var(--brand)] text-white shadow-[0_4px_16px_var(--kiosk-brand-glow)]"
              : "kiosk-glass-panel text-[var(--kiosk-text)]",
          )}
        >
          Home
        </Link>
        {destinations.map((destination) => {
          const Icon = destinationIcons[destination.id];
          const active = isDestinationActive(pathname, destination);
          const itemClassName = cn(
            "inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition active:scale-95",
            active
              ? "bg-[var(--brand)] text-white shadow-[0_4px_16px_var(--kiosk-brand-glow)]"
              : "kiosk-glass-panel text-[var(--kiosk-text)]",
          );

          if (destination.registrationUrl) {
            return (
              <button
                key={destination.id}
                type="button"
                onClick={() => openRegistration(destination.registrationUrl!)}
                className={itemClassName}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {destination.label}
              </button>
            );
          }

          return (
            <Link key={destination.id} href={destination.href} className={itemClassName}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {destination.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
