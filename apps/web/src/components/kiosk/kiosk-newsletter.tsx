"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Mail } from "lucide-react";
import { useKioskSettings } from "@/components/kiosk/kiosk-settings-context";
import { openRegistration } from "@/lib/kiosk-shell";

function isNewsletterAvailable(settings: {
  newsletterEnabled: boolean;
  newsletterUrl: string;
}) {
  return settings.newsletterEnabled && settings.newsletterUrl.trim().length > 0;
}

export function KioskNewsletter() {
  const settings = useKioskSettings();
  const [openingLink, setOpeningLink] = useState(false);

  if (!settings) {
    return (
      <div className="kiosk-on-bg kiosk-on-bg-muted flex min-h-[50vh] items-center justify-center text-xl">
        Loading…
      </div>
    );
  }

  const available = isNewsletterAvailable(settings);
  const buttonLabel = settings.newsletterButtonLabel.trim() || "Sign up";

  const handleOpenLink = () => {
    if (!available) return;
    setOpeningLink(true);
    openRegistration(settings.newsletterUrl);
    setTimeout(() => setOpeningLink(false), 2000);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
      <Link
        href="/kiosk"
        className="kiosk-glass-panel mb-6 inline-flex h-16 items-center gap-2 rounded-2xl px-5 text-lg font-semibold text-[var(--kiosk-text)] transition active:scale-95"
      >
        <ArrowLeft className="h-[22px] w-[22px]" />
        Back to Home
      </Link>

      <div
        className="mb-6 flex h-40 w-full items-center justify-center rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
        style={{
          background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-secondary) 100%)",
        }}
      >
        <Mail className="h-12 w-12 text-white/50" />
      </div>

      <h1 className="kiosk-on-bg kiosk-on-bg-text kiosk-display mb-5 text-[clamp(1.75rem,4vw,2.625rem)] font-black leading-tight">
        {settings.newsletterTitle}
      </h1>

      {settings.newsletterBody && (
        <div className="kiosk-glass mb-8 rounded-[20px] p-6">
          <p className="text-lg leading-relaxed text-[color-mix(in_srgb,var(--kiosk-text)_85%,transparent)]">
            {settings.newsletterBody}
          </p>
        </div>
      )}

      {available ? (
        <button
          type="button"
          onClick={handleOpenLink}
          disabled={openingLink}
          className="flex h-[72px] w-full items-center justify-center gap-3 rounded-[20px] text-xl font-semibold text-white transition active:scale-[0.98] disabled:opacity-80"
          style={{
            background: openingLink
              ? "color-mix(in srgb, var(--brand) 80%, transparent)"
              : "linear-gradient(135deg, var(--brand) 0%, var(--brand-secondary) 100%)",
            boxShadow: "0 8px 24px var(--kiosk-brand-glow)",
          }}
        >
          {openingLink ? (
            <>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Opening sign up…
            </>
          ) : (
            <>
              <ExternalLink className="h-[22px] w-[22px]" />
              {buttonLabel}
            </>
          )}
        </button>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[color-mix(in_srgb,var(--kiosk-muted)_30%,transparent)] bg-white/90 px-8 py-16 text-center">
          <Mail className="mb-4 h-12 w-12 text-[var(--kiosk-muted)]" />
          <h3 className="kiosk-display mb-2 text-2xl font-bold text-[var(--kiosk-text)]">
            Newsletter sign-up is not available
          </h3>
          <p className="text-lg text-[var(--kiosk-muted)]">Please check back later.</p>
        </div>
      )}
    </div>
  );
}
