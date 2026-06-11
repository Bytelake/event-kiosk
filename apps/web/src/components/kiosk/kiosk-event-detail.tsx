"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchKioskEvents, type KioskEvent } from "@/lib/kiosk-api";
import { openRegistration } from "@/lib/kiosk-shell";
import { formatKioskEventScheduleDisplay } from "@/lib/utils";

export function KioskEventDetail() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<KioskEvent | null>(null);

  useEffect(() => {
    fetchKioskEvents().then((events) => {
      setEvent(events.find((e) => e.id === params.id) ?? null);
    });
  }, [params.id]);

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center text-2xl text-[var(--kiosk-muted)]">
        Loading event...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <Link href="/kiosk">
        <Button variant="secondary" size="kiosk" className="mb-8 gap-3">
          <ArrowLeft className="h-6 w-6" />
          Back to Events
        </Button>
      </Link>

      {event.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.imageUrl}
          alt={event.title}
          className="mb-8 h-72 w-full rounded-3xl object-cover md:h-96"
        />
      )}

      <h1 className="text-5xl font-bold text-[var(--kiosk-text)]">{event.title}</h1>

      <div className="mt-6 flex flex-wrap gap-6 text-xl text-[color-mix(in_srgb,var(--kiosk-text)_75%,transparent)]">
        <span className="inline-flex items-center gap-3">
          <Calendar className="h-7 w-7" />
          {formatKioskEventScheduleDisplay(event.startAt, event.endAt, event.allDay)}
        </span>
        {event.location && (
          <span className="inline-flex items-center gap-3">
            <MapPin className="h-7 w-7" />
            {event.location}
          </span>
        )}
      </div>

      {(event.fullDescription || event.shortDescription) && (
        <div className="mt-10 rounded-3xl bg-white/90 p-8 text-xl leading-relaxed text-[color-mix(in_srgb,var(--kiosk-text)_85%,transparent)] shadow-sm backdrop-blur-sm">
          {event.fullDescription || event.shortDescription}
        </div>
      )}

      {event.registrationUrl && (
        <div className="mt-10">
          <Button
            size="kiosk"
            className="w-full max-w-xl bg-[var(--brand)] text-white hover:bg-[color-mix(in_srgb,var(--brand)_88%,#000)]"
            onClick={() => openRegistration(event.registrationUrl!)}
          >
            Register for This Event
          </Button>
        </div>
      )}
    </div>
  );
}
