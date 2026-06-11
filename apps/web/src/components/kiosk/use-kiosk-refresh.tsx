"use client";

import { useEffect, useRef } from "react";
import { fetchPublicSettings, type KioskSettings } from "@/lib/kiosk-api";

const POLL_MS = 5000;

export function useKioskRefresh(options?: {
  onSettings?: (settings: KioskSettings) => void;
}) {
  const lastRefreshAt = useRef<string | null>(null);
  const lastSettingsUpdatedAt = useRef<string | null>(null);
  const initialized = useRef(false);
  const onSettings = options?.onSettings;

  useEffect(() => {
    async function loadSettings() {
      if (!onSettings) return;
      onSettings(await fetchPublicSettings());
    }

    async function check() {
      try {
        const res = await fetch("/api/kiosk/sync", { cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as {
          kioskRefreshAt?: string | null;
          settingsUpdatedAt?: string | null;
        };
        const refreshAt = data.kioskRefreshAt ?? null;
        const settingsUpdatedAt = data.settingsUpdatedAt ?? null;

        if (!initialized.current) {
          initialized.current = true;
          lastRefreshAt.current = refreshAt;
          lastSettingsUpdatedAt.current = settingsUpdatedAt;
          void loadSettings();
          return;
        }

        if (refreshAt !== lastRefreshAt.current) {
          lastRefreshAt.current = refreshAt;
          window.location.reload();
          return;
        }

        if (
          onSettings &&
          settingsUpdatedAt !== lastSettingsUpdatedAt.current
        ) {
          lastSettingsUpdatedAt.current = settingsUpdatedAt;
          await loadSettings();
        }
      } catch {
        // Ignore polling errors; kiosk keeps showing current content.
      }
    }

    void check();
    const interval = setInterval(check, POLL_MS);
    return () => clearInterval(interval);
  }, [onSettings]);
}
