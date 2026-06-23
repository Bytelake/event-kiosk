"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Calendar, MapPin, ChevronRight, WifiOff } from "lucide-react";
import { fetchKioskEvents, fetchPublicSettings, type KioskEvent, type KioskSettings } from "@/lib/kiosk-api";
import {
  formatEventCardDateBadge,
  formatKioskEventCardDisplay,
  cn,
} from "@/lib/utils";
import { preloadImageUrls } from "@/lib/preload-images";

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
      preloadImageUrls([
        settingsData.orgLogoUrl,
        settingsData.kioskBackgroundImageUrl,
        ...eventData.map((event) => event.imageUrl),
      ]);
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
          Upcoming Events
        </h1>
        <p className="kiosk-on-bg kiosk-on-bg-muted mt-2 text-lg">Tap an event to learn more</p>
      </header>

      {offline && <OfflineBanner />}

      {featured.length > 0 && (
        <section className="mb-8">
          <SectionHeading>Featured</SectionHeading>
          <div className="flex flex-col gap-4">
            {featured.map((event) => (
              <EventCard key={event.id} event={event} featured />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading>All Events</SectionHeading>
        {events.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(regular.length > 0 ? regular : events).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="kiosk-on-bg kiosk-on-bg-muted mb-4 text-[13px] font-semibold uppercase tracking-widest">
      {children}
    </h2>
  );
}

function OfflineBanner() {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-300/50 bg-amber-100/95 px-5 py-3">
      <WifiOff className="h-5 w-5 shrink-0 text-amber-600" />
      <p className="text-base text-amber-900">
        <strong>Connection unavailable</strong> — showing last loaded events
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[color-mix(in_srgb,var(--kiosk-muted)_30%,transparent)] bg-white/90 px-8 py-16 text-center">
      <Calendar className="mb-4 h-12 w-12 text-[var(--kiosk-muted)]" />
      <h3 className="kiosk-display mb-2 text-2xl font-bold text-[var(--kiosk-text)]">
        No upcoming events right now
      </h3>
      <p className="text-lg text-[var(--kiosk-muted)]">Please check back soon.</p>
    </div>
  );
}

function DateBadge({
  label,
  day,
  time,
}: {
  label: string;
  day: string;
  time: string;
}) {
  return (
    <div className="kiosk-glass-on-dark flex min-w-[64px] flex-col items-center rounded-2xl px-3 py-2">
      <span className="text-[11px] font-semibold tracking-[0.12em] text-white/80">
        {label}
      </span>
      <span className="kiosk-display text-[28px] font-bold leading-none text-white">
        {day}
      </span>
      {time && time !== "All day" ? (
        <span className="mt-0.5 text-[10px] text-white/70">{time.split(" - ")[0]}</span>
      ) : null}
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
        "group relative flex w-full flex-col overflow-hidden rounded-3xl text-left shadow-[0_8px_32px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.08)] transition active:scale-[0.985]",
        featured ? "min-h-[360px]" : "min-h-[220px]",
      )}
    >
      {hasImage ? (
        <>
          <div
            className="absolute inset-0 bg-slate-700 bg-cover bg-center"
            style={{ backgroundImage: `url(${event.imageUrl})` }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.82) 100%)",
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-secondary) 100%)",
          }}
        />
      )}

      <div className="relative flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="flex items-start justify-between">
          <DateBadge label={badge.label} day={badge.day} time={badge.time} />
          <div className="kiosk-glass-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <ChevronRight className="h-5 w-5 text-white" />
          </div>
        </div>

        <div>
          <h3
            className={cn(
              "kiosk-display mb-1 font-bold leading-tight text-white",
              featured ? "text-[40px]" : "text-[28px]",
            )}
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.45)" }}
          >
            {event.title}
          </h3>
          {event.shortDescription && (
            <p
              className="mb-3 line-clamp-2 text-[15px] leading-snug text-white/80"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
            >
              {event.shortDescription}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-[13px] text-white/70">
              <Calendar className="h-3.5 w-3.5" />
              {formatKioskEventCardDisplay(event.startAt, event.endAt, event.allDay)}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-white/70">
                <MapPin className="h-3.5 w-3.5" />
                {event.location}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
