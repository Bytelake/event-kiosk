"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Heart } from "lucide-react";
import { useKioskSettings } from "@/components/kiosk/kiosk-settings-context";

const fieldClass =
  "block w-full rounded-2xl border-2 border-[color-mix(in_srgb,var(--kiosk-muted)_25%,transparent)] bg-white/95 px-5 py-4 text-xl text-[var(--kiosk-text)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--kiosk-brand-glow)]";

export function KioskGivingForm() {
  const settings = useKioskSettings();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!settings) {
    return (
      <div className="kiosk-on-bg kiosk-on-bg-muted flex min-h-[50vh] items-center justify-center text-xl">
        Loading…
      </div>
    );
  }

  if (!settings.givingEnabled) {
    return (
      <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
        <Link
          href="/kiosk"
          className="kiosk-glass-panel mb-6 inline-flex h-16 items-center gap-2 rounded-2xl px-5 text-lg font-semibold text-[var(--kiosk-text)] transition active:scale-95"
        >
          <ArrowLeft className="h-[22px] w-[22px]" />
          Back to Home
        </Link>
        <p className="kiosk-on-bg kiosk-on-bg-muted text-xl">Giving is not available right now.</p>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/kiosk/giving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone || undefined }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
        <Link
          href="/kiosk"
          className="kiosk-glass-panel mb-6 inline-flex h-16 items-center gap-2 rounded-2xl px-5 text-lg font-semibold text-[var(--kiosk-text)] transition active:scale-95"
        >
          <ArrowLeft className="h-[22px] w-[22px]" />
          Back to Home
        </Link>

        <div className="kiosk-glass flex flex-col items-center rounded-[20px] px-8 py-16 text-center">
          <CheckCircle2 className="mb-4 h-16 w-16 text-[var(--brand)]" />
          <p className="text-xl leading-relaxed text-[color-mix(in_srgb,var(--kiosk-text)_90%,transparent)]">
            {settings.givingSuccessMessage}
          </p>
        </div>
      </div>
    );
  }

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
        <Heart className="h-12 w-12 text-white/50" />
      </div>

      <h1 className="kiosk-on-bg kiosk-on-bg-text kiosk-display mb-5 text-[clamp(1.75rem,4vw,2.625rem)] font-black leading-tight">
        {settings.givingTitle}
      </h1>

      {settings.givingBody && (
        <div className="kiosk-glass mb-8 rounded-[20px] p-6">
          <p className="text-lg leading-relaxed text-[color-mix(in_srgb,var(--kiosk-text)_85%,transparent)]">
            {settings.givingBody}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="kiosk-glass space-y-5 rounded-[20px] p-6 md:p-8">
        <div>
          <label htmlFor="giving-name" className="mb-2 block text-lg font-semibold text-[var(--kiosk-text)]">
            Name <span className="text-[var(--brand)]">*</span>
          </label>
          <input
            id="giving-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="giving-email" className="mb-2 block text-lg font-semibold text-[var(--kiosk-text)]">
            Email <span className="text-[var(--brand)]">*</span>
          </label>
          <input
            id="giving-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="giving-phone" className="mb-2 block text-lg font-semibold text-[var(--kiosk-text)]">
            Phone <span className="font-normal text-[var(--kiosk-muted)]">(optional)</span>
          </label>
          <input
            id="giving-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={fieldClass}
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-lg text-red-700" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-[72px] w-full items-center justify-center gap-3 rounded-[20px] text-xl font-semibold text-white transition active:scale-[0.98] disabled:opacity-80"
          style={{
            background: submitting
              ? "color-mix(in srgb, var(--brand) 80%, transparent)"
              : "linear-gradient(135deg, var(--brand) 0%, var(--brand-secondary) 100%)",
            boxShadow: "0 8px 24px var(--kiosk-brand-glow)",
          }}
        >
          {submitting ? (
            <>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Submitting…
            </>
          ) : (
            "Submit"
          )}
        </button>
      </form>
    </div>
  );
}
