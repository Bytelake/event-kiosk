"use client";

import { useEffect, useRef } from "react";

const POLL_MS = 5000;

export function useKioskRefresh() {
  const lastRefreshAt = useRef<string | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as { kioskRefreshAt?: string | null };
        const refreshAt = data.kioskRefreshAt ?? null;

        if (
          refreshAt &&
          lastRefreshAt.current &&
          refreshAt !== lastRefreshAt.current
        ) {
          window.location.reload();
        }

        if (refreshAt) {
          lastRefreshAt.current = refreshAt;
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
