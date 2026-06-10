"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Calendar, MapPin, ChevronRight } from "lucide-react";
import { fetchKioskEvents, fetchPublicSettings, type KioskEvent, type KioskSettings } from "@/lib/kiosk-api";
import {
  formatEventCardDateBadge,
  formatKioskEventCardDisplay,
  cn,
} from "@/lib/utils";

export function KioskHome() {
  const [events, setEvents] = useState<KioskEvent[]>([]);
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const [eventData, settingsData] = await Promise.all([
        fetchKioskEvents(),
        fetchPublicSettings(),
      ]);
      setEvents(eventData);
      setSettings(settingsData);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  const featured = events.filter((e) => e.featured);
  const regular = events.filter((e) => !e.featured);

  return (
    <div>
      {offline && (
        <div className="bg-amber-100 px-6 py-3 text-center text-lg text-amber-900">
          Connection unavailable — showing last loaded events
        </div>
      )}

      <div className="mx-auto max-w-[1400px] px-8 py-12 md:px-12">
        <header className="mb-12 text-center">
          {settings?.orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.orgLogoUrl}
              alt={settings.orgName}
              className="mx-auto mb-6 h-24 w-auto object-contain"
            />
          ) : null}
          <p className="text-xl font-medium text-[var(--kiosk-muted)]">{settings?.orgName ?? "Welcome"}</p>
          <h1 className="mt-2 text-5xl font-bold tracking-tight text-[var(--kiosk-text)] md:text-6xl">
            Upcoming Events
          </h1>
          <p className="mt-4 text-xl text-[color-mix(in_srgb,var(--kiosk-text)_70%,transparent)]">
            Tap an event to learn more
          </p>
        </header>

        {featured.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-semibold text-[var(--kiosk-text)]">Featured</h2>
            <div className="grid grid-cols-1 gap-8">
              {featured.map((event) => (
                <EventCard key={event.id} event={event} featured />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-6 text-2xl font-semibold text-[var(--kiosk-text)]">All Events</h2>
          {events.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color-mix(in_srgb,var(--kiosk-muted)_35%,transparent)] bg-white/90 p-16 text-center backdrop-blur-sm">
              <p className="text-2xl text-[var(--kiosk-muted)]">No upcoming events right now</p>
              <p className="mt-2 text-lg text-[color-mix(in_srgb,var(--kiosk-muted)_75%,transparent)]">
                Please check back soon
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {(regular.length > 0 ? regular : events).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EventCard({ event, featured = false }: { event: KioskEvent; featured?: boolean }) {
  const hasImage = Boolean(event.imageUrl);
  const badge = formatEventCardDateBadge(event.startAt, event.endAt, event.allDay);

  return (
    <Link
      href={`/kiosk/events/${event.id}`}
      className={cn(
        "group relative flex min-h-[280px] overflow-hidden rounded-3xl shadow-md transition active:scale-[0.99] hover:shadow-xl",
        featured ? "min-h-[360px]" : "min-h-[300px]",
      )}
    >
      {hasImage ? (
        <>
          <div
            className="absolute inset-0 scale-100 bg-cover bg-center transition duration-700 group-hover:scale-105"
            style={{ backgroundImage: `url(${event.imageUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/25" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand)] via-[var(--brand)] to-[var(--brand-secondary)]" />
      )}

      <div className="absolute left-6 top-6 flex min-w-[5.5rem] flex-col items-center rounded-2xl bg-white/95 px-4 py-3 text-center shadow-lg backdrop-blur-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">
          {badge.label}
        </span>
        <span className="text-4xl font-bold leading-none text-slate-900">
          {badge.day}
        </span>
        {badge.time ? (
          <span className="mt-1 text-sm font-medium text-slate-600">{badge.time}</span>
        ) : null}
      </div>

      <div className="relative flex w-full items-start justify-between gap-6 p-6 pt-28 md:p-8 md:pt-32">
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "font-bold leading-tight text-white drop-shadow-md",
              featured ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl",
            )}
          >
            {event.title}
          </h3>
          {event.shortDescription && (
            <p
              className={cn(
                "mt-3 line-clamp-3 text-white/90",
                featured ? "text-xl md:text-2xl" : "text-lg md:text-xl",
              )}
            >
              {event.shortDescription}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-base text-white/85 md:text-lg">
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-5 w-5 shrink-0" />
              {formatKioskEventCardDisplay(event.startAt, event.endAt, event.allDay)}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-5 w-5 shrink-0" />
                {event.location}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-10 w-10 shrink-0 text-white/70 transition group-hover:translate-x-1 group-hover:text-white md:h-12 md:w-12" />
      </div>
    </Link>
  );
}
