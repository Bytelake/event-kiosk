"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { useKioskSettings } from "@/components/kiosk/kiosk-settings-context";
import {
  isNewsletterAvailable,
  openNewsletterRegistration,
} from "@/lib/kiosk-newsletter";

export function KioskNewsletter() {
  const settings = useKioskSettings();
  const router = useRouter();

  useEffect(() => {
    if (!settings) return;
    if (openNewsletterRegistration(settings)) {
      router.replace("/kiosk");
    }
  }, [settings, router]);

  if (!settings) {
    return (
      <div className="kiosk-on-bg kiosk-on-bg-muted flex min-h-[50vh] items-center justify-center text-xl">
        Loading…
      </div>
    );
  }

  if (!isNewsletterAvailable(settings)) {
    return (
      <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[color-mix(in_srgb,var(--kiosk-muted)_30%,transparent)] bg-white/90 px-8 py-16 text-center">
          <Mail className="mb-4 h-12 w-12 text-[var(--kiosk-muted)]" />
          <h3 className="kiosk-display mb-2 text-2xl font-bold text-[var(--kiosk-text)]">
            Newsletter sign-up is not available
          </h3>
          <p className="text-lg text-[var(--kiosk-muted)]">Please check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-on-bg kiosk-on-bg-muted flex min-h-[50vh] items-center justify-center text-xl">
      Opening newsletter…
    </div>
  );
}
