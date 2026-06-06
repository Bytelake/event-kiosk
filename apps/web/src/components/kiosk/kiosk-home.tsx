"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Calendar, MapPin, ChevronRight } from "lucide-react";
import { fetchKioskEvents, fetchPublicSettings, type KioskEvent, type KioskSettings } from "@/lib/kiosk-api";
import { formatEventDate, formatEventTime, cn } from "@/lib/utils";

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
    <div
      className="min-h-screen bg-gradient-to-b from-slate-50 to-white"
      style={{ ["--brand" as string]: settings?.brandPrimaryColor ?? "#2563eb" }}
    >
      {offline && (
        <div className="bg-amber-100 px-6 py-3 text-center text-lg text-amber-900">
          Connection unavailable — showing last loaded events
        </div>
      )}

      <div className="mx-auto max-w-7xl px-8 py-12 md:px-12">
        <header className="mb-12 text-center">
          {settings?.orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.orgLogoUrl}
              alt={settings.orgName}
              className="mx-auto mb-6 h-24 w-auto object-contain"
            />
          ) : null}
          <p className="text-xl font-medium text-slate-500">{settings?.orgName ?? "Welcome"}</p>
          <h1 className="mt-2 text-5xl font-bold tracking-tight text-slate-900 md:text-6xl">
            Upcoming Events
          </h1>
          <p className="mt-4 text-xl text-slate-600">Tap an event to learn more and register</p>
        </header>

        {featured.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-6 text-2xl font-semibold text-slate-800">Featured</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {featured.map((event) => (
                <EventCard key={event.id} event={event} featured />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-6 text-2xl font-semibold text-slate-800">All Events</h2>
          {events.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center">
              <p className="text-2xl text-slate-500">No upcoming events right now</p>
              <p className="mt-2 text-lg text-slate-400">Please check back soon</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
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
  return (
    <Link
      href={`/kiosk/events/${event.id}`}
      className={cn(
        "group flex min-h-[140px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition active:scale-[0.99] hover:shadow-md",
        featured && "md:min-h-[220px]",
      )}
    >
      <div
        className={cn(
          "flex w-28 shrink-0 flex-col items-center justify-center bg-[var(--brand)] px-3 text-white",
          featured && "w-36",
        )}
      >
        <span className="text-sm font-semibold uppercase tracking-wide opacity-90">
          {formatEventDate(event.startAt).split(",")[0]}
        </span>
        <span className="mt-1 text-3xl font-bold">{new Date(event.startAt).getDate()}</span>
        <span className="mt-1 text-sm opacity-90">{formatEventTime(event.startAt)}</span>
      </div>

      <div className="flex flex-1 items-center gap-4 p-5">
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.imageUrl}
            alt=""
            className="hidden h-24 w-24 rounded-2xl object-cover sm:block"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className={cn("font-bold text-slate-900", featured ? "text-2xl" : "text-xl")}>
            {event.title}
          </h3>
          {event.shortDescription && (
            <p className="mt-2 line-clamp-2 text-lg text-slate-600">{event.shortDescription}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-base text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {formatEventDate(event.startAt)}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {event.location}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-8 w-8 shrink-0 text-slate-300 transition group-hover:text-[var(--brand)]" />
      </div>
    </Link>
  );
}
