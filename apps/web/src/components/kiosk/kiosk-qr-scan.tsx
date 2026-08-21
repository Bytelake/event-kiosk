"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, QrCode } from "lucide-react";
import { KioskBackButton } from "@/components/kiosk/kiosk-back-button";
import { useKioskSettings } from "@/components/kiosk/kiosk-settings-context";
import {
  isPrintableScanKey,
  parseScannedQrUrl,
  QR_SCAN_CHAR_GAP_MS,
  QR_SCAN_IDLE_COMMIT_MS,
} from "@/lib/kiosk-qr-scan";
import { onRegistrationClosed, openRegistration } from "@/lib/kiosk-shell";

type ScanStatus = "ready" | "opening" | "error";

export function KioskQrScan() {
  const settings = useKioskSettings();
  const [status, setStatus] = useState<ScanStatus>("ready");
  const [errorMessage, setErrorMessage] = useState("");
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openingRef = useRef(false);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const resetBuffer = useCallback(() => {
    bufferRef.current = "";
    lastKeyAtRef.current = 0;
    clearIdleTimer();
  }, [clearIdleTimer]);

  const resetToReady = useCallback(() => {
    openingRef.current = false;
    resetBuffer();
    setStatus("ready");
    setErrorMessage("");
  }, [resetBuffer]);

  const commitScan = useCallback(
    (raw: string) => {
      if (openingRef.current) return;

      const url = parseScannedQrUrl(raw);
      resetBuffer();

      if (!url) {
        setStatus("error");
        setErrorMessage("That code is not a valid web link. Try another QR code.");
        return;
      }

      openingRef.current = true;
      setStatus("opening");
      setErrorMessage("");
      openRegistration(url, { allowAnyDomain: true });
    },
    [resetBuffer],
  );

  // After Done (or idle close), shell focuses the hub and notifies — unlock scanning.
  useEffect(() => {
    return onRegistrationClosed(() => {
      resetToReady();
    });
  }, [resetToReady]);

  // Browser / desktop fallback when there is no Electron close event.
  useEffect(() => {
    function onFocus() {
      if (openingRef.current) {
        resetToReady();
      }
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [resetToReady]);

  useEffect(() => {
    function scheduleIdleCommit() {
      clearIdleTimer();
      idleTimerRef.current = setTimeout(() => {
        if (bufferRef.current) {
          commitScan(bufferRef.current);
        }
      }, QR_SCAN_IDLE_COMMIT_MS);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (openingRef.current) return;

      const now = Date.now();

      if (event.key === "Enter") {
        event.preventDefault();
        if (bufferRef.current) {
          commitScan(bufferRef.current);
        }
        return;
      }

      if (!isPrintableScanKey(event.key)) return;

      event.preventDefault();

      if (lastKeyAtRef.current && now - lastKeyAtRef.current > QR_SCAN_CHAR_GAP_MS) {
        bufferRef.current = "";
      }

      bufferRef.current += event.key;
      lastKeyAtRef.current = now;
      setStatus("ready");
      setErrorMessage("");
      scheduleIdleCommit();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearIdleTimer();
    };
  }, [clearIdleTimer, commitScan]);

  if (!settings) {
    return (
      <div className="kiosk-on-bg kiosk-on-bg-muted flex min-h-[50vh] items-center justify-center text-xl">
        Loading…
      </div>
    );
  }

  if (!settings.qrScanEnabled) {
    return (
      <div className="relative mx-auto max-w-[1400px] px-5 py-10 md:px-8">
        <KioskBackButton href="/kiosk" label="Back to home" overlay />
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[color-mix(in_srgb,var(--kiosk-muted)_30%,transparent)] bg-white/90 px-8 py-16 text-center">
          <QrCode className="mb-4 h-12 w-12 text-[var(--kiosk-muted)]" />
          <h3 className="kiosk-display mb-2 text-2xl font-bold text-[var(--kiosk-text)]">
            QR scanning is not available
          </h3>
          <p className="text-lg text-[var(--kiosk-muted)]">Please check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-[1400px] flex-col px-5 pb-36 pt-10 md:px-8">
      <KioskBackButton href="/kiosk" label="Back to home" overlay />

      <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
        <div
          className="mb-8 inline-flex h-24 w-24 items-center justify-center rounded-3xl text-white"
          style={{
            background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-secondary) 100%)",
            boxShadow: "0 8px 24px var(--kiosk-brand-glow)",
          }}
        >
          <QrCode className="h-12 w-12" aria-hidden />
        </div>
        <h1 className="kiosk-on-bg kiosk-on-bg-text kiosk-display mb-4 text-[clamp(2rem,5vw,3rem)] font-black">
          {settings.qrScanTitle}
        </h1>
        <p className="kiosk-on-bg kiosk-on-bg-muted max-w-xl text-xl leading-snug">
          {settings.qrScanBody}
        </p>

        <p
          className="kiosk-on-bg mt-10 text-lg font-medium"
          aria-live="polite"
          style={{
            color:
              status === "error"
                ? "var(--kiosk-muted)"
                : status === "opening"
                  ? "var(--brand)"
                  : undefined,
          }}
        >
          {status === "opening"
            ? "Link open — tap Done when finished"
            : status === "error"
              ? errorMessage
              : "Ready to scan"}
        </p>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 md:bottom-8"
        aria-hidden
      >
        <p className="kiosk-on-bg kiosk-on-bg-text kiosk-display text-2xl font-bold tracking-wide">
          Scan here
        </p>
        <div
          className="kiosk-scan-cue inline-flex h-16 w-16 items-center justify-center rounded-full text-white"
          style={{
            background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-secondary) 100%)",
            boxShadow: "0 8px 24px var(--kiosk-brand-glow)",
          }}
        >
          <ArrowDown className="h-9 w-9" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}
