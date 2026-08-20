"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  fetchPublicSettings,
  getCachedKioskSettings,
  type KioskSettings,
} from "@/lib/kiosk-api";

export function KioskDestinationStub({
  title,
  body,
  backHref = "/kiosk",
  backLabel = "Back to Home",
}: {
  title: string;
  body: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
      <Link
        href={backHref}
        className="kiosk-glass-panel mb-6 inline-flex h-16 items-center gap-2 rounded-2xl px-5 text-lg font-semibold text-[var(--kiosk-text)] transition active:scale-95"
      >
        <ArrowLeft className="h-[22px] w-[22px]" />
        {backLabel}
      </Link>

      <div className="kiosk-glass rounded-[20px] p-8">
        <h1 className="kiosk-on-bg kiosk-on-bg-text kiosk-display mb-4 text-[clamp(1.75rem,4vw,2.625rem)] font-black leading-tight">
          {title}
        </h1>
        <p className="text-lg leading-relaxed text-[color-mix(in_srgb,var(--kiosk-text)_85%,transparent)]">
          {body}
        </p>
        <p className="mt-6 text-base text-[color-mix(in_srgb,var(--kiosk-text)_65%,transparent)]">
          This page is coming soon.
        </p>
      </div>
    </div>
  );
}

export function KioskNewsletterStub() {
  const [settings, setSettings] = useState<KioskSettings | null>(
    () => getCachedKioskSettings(),
  );

  useEffect(() => {
    fetchPublicSettings().then(setSettings).catch(() => undefined);
  }, []);

  return (
    <KioskDestinationStub
      title={settings?.newsletterTitle ?? "Newsletter"}
      body={settings?.newsletterBody ?? "Stay connected. Sign up for our newsletter."}
    />
  );
}

export function KioskGiveStub() {
  const [settings, setSettings] = useState<KioskSettings | null>(
    () => getCachedKioskSettings(),
  );

  useEffect(() => {
    fetchPublicSettings().then(setSettings).catch(() => undefined);
  }, []);

  return (
    <KioskDestinationStub
      title={settings?.givingTitle ?? "Give"}
      body={
        settings?.givingBody ??
        "Share your contact information and we will follow up with ways to give."
      }
    />
  );
}
