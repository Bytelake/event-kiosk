"use client";

import { useEffect, useRef } from "react";

const POLL_MS = 5000;

export function useKioskRefresh() {
  const lastRefreshAt = useRef<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as { kioskRefreshAt?: string | null };
        const refreshAt = data.kioskRefreshAt ?? null;

        if (!initialized.current) {
          initialized.current = true;
          lastRefreshAt.current = refreshAt;
          return;
        }

        if (refreshAt !== lastRefreshAt.current) {
          lastRefreshAt.current = refreshAt;
          window.location.reload();
        }
      } catch {
        // Ignore polling errors; kiosk keeps showing current content.
      }
    }

    void check();
    const interval = setInterval(check, POLL_MS);
    return () => clearInterval(interval);
  }, []);
}
