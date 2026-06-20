"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, MapPin, ExternalLink } from "lucide-react";
import { fetchKioskEvent, type KioskEvent } from "@/lib/kiosk-api";
import { openRegistration } from "@/lib/kiosk-shell";
import { formatKioskEventScheduleDisplay } from "@/lib/utils";

export function KioskEventDetail() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<KioskEvent | null>(null);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetchKioskEvent(params.id).then(setEvent);
  }, [params.id]);

  const handleRegister = () => {
    if (!event?.registrationUrl) return;
    setRegistering(true);
    openRegistration(event.registrationUrl);
    setTimeout(() => setRegistering(false), 2000);
  };

  if (!event) {
    return (
      <div className="kiosk-on-bg kiosk-on-bg-muted flex min-h-[50vh] items-center justify-center text-xl">
        Loading event…
      </div>
    );
  }

  const schedule = formatKioskEventScheduleDisplay(event.startAt, event.endAt, event.allDay);

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
      <Link
        href="/kiosk"
        className="kiosk-glass-panel mb-6 inline-flex h-16 items-center gap-2 rounded-2xl px-5 text-lg font-semibold text-[var(--kiosk-text)] transition active:scale-95"
      >
        <ArrowLeft className="h-[22px] w-[22px]" />
        Back to Events
      </Link>

      {event.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.imageUrl}
          alt={event.title}
          className="mb-6 h-[280px] w-full rounded-3xl object-cover shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
        />
      ) : (
        <div
          className="mb-6 flex h-40 w-full items-center justify-center rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
          style={{
            background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-secondary) 100%)",
          }}
        >
          <Calendar className="h-12 w-12 text-white/50" />
        </div>
      )}

      <h1 className="kiosk-on-bg kiosk-on-bg-text kiosk-display mb-5 text-[clamp(1.75rem,4vw,2.625rem)] font-black leading-tight">
        {event.title}
      </h1>

      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-3">
        <div className="kiosk-on-bg flex items-center gap-2 text-lg text-[color-mix(in_srgb,var(--kiosk-surface-text)_75%,transparent)]">
          <Calendar className="h-5 w-5 text-[var(--brand)]" />
          {schedule}
        </div>
        {event.location && (
          <div className="kiosk-on-bg flex items-center gap-2 text-lg text-[color-mix(in_srgb,var(--kiosk-surface-text)_75%,transparent)]">
            <MapPin className="h-5 w-5 text-[var(--brand)]" />
            {event.location}
          </div>
        )}
      </div>

      {(event.fullDescription || event.shortDescription) && (
        <div className="kiosk-glass mb-8 rounded-[20px] p-6">
          <p className="text-lg leading-relaxed text-[color-mix(in_srgb,var(--kiosk-text)_85%,transparent)]">
            {event.fullDescription || event.shortDescription}
          </p>
        </div>
      )}

      {event.registrationUrl && (
        <button
          type="button"
          onClick={handleRegister}
          disabled={registering}
          className="flex h-[72px] w-full items-center justify-center gap-3 rounded-[20px] text-xl font-semibold text-white transition active:scale-[0.98] disabled:opacity-80"
          style={{
            background: registering
              ? "color-mix(in srgb, var(--brand) 80%, transparent)"
              : "linear-gradient(135deg, var(--brand) 0%, var(--brand-secondary) 100%)",
            boxShadow: "0 8px 24px var(--kiosk-brand-glow)",
          }}
        >
          {registering ? (
            <>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Opening registration…
            </>
          ) : (
            <>
              <ExternalLink className="h-[22px] w-[22px]" />
              Register for This Event
            </>
          )}
        </button>
      )}
    </div>
  );
}
