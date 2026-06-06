"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchKioskEvents, type KioskEvent } from "@/lib/kiosk-api";
import { openRegistration } from "@/lib/kiosk-shell";
import { formatEventDate, formatEventTime } from "@/lib/utils";
import { useIdleTimeout } from "@/components/kiosk/use-idle-timeout";

export function KioskEventDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<KioskEvent | null>(null);

  useIdleTimeout(() => router.push("/kiosk"), 60000);

  useEffect(() => {
    fetchKioskEvents().then((events) => {
      setEvent(events.find((e) => e.id === params.id) ?? null);
    });
  }, [params.id]);

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center text-2xl text-slate-500">
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

      <h1 className="text-5xl font-bold text-slate-900">{event.title}</h1>

      <div className="mt-6 flex flex-wrap gap-6 text-xl text-slate-600">
        <span className="inline-flex items-center gap-3">
          <Calendar className="h-7 w-7" />
          {formatEventDate(event.startAt)} · {formatEventTime(event.startAt)}
        </span>
        {event.location && (
          <span className="inline-flex items-center gap-3">
            <MapPin className="h-7 w-7" />
            {event.location}
          </span>
        )}
      </div>

      {(event.fullDescription || event.shortDescription) && (
        <div className="mt-10 rounded-3xl bg-white/90 p-8 text-xl leading-relaxed text-slate-700 shadow-sm backdrop-blur-sm">
          {event.fullDescription || event.shortDescription}
        </div>
      )}

      {event.registrationUrl && (
        <div className="mt-10">
          <Button
            size="kiosk"
            className="w-full max-w-xl bg-blue-600 hover:bg-blue-700"
            onClick={() => openRegistration(event.registrationUrl!)}
          >
            Register for This Event
          </Button>
        </div>
      )}
    </div>
  );
}
