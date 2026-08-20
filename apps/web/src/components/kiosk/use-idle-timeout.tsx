"use client";

import { useEffect } from "react";

export const KIOSK_USER_ACTIVITY_EVENT = "kiosk-user-activity";

const ACTIVITY_EVENTS = [
  "touchstart",
  "mousedown",
  "keydown",
  "scroll",
  KIOSK_USER_ACTIVITY_EVENT,
];

export function useIdleTimeout(onTimeout: () => void, ms: number | null) {
  useEffect(() => {
    const timeoutMs = ms;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function reset() {
      window.kioskShell?.notifyActivity?.();
      if (timeoutMs === null) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(onTimeout, timeoutMs);
    }

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, reset, { passive: true }),
    );
    reset();

    return () => {
      if (timer) clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, reset),
      );
    };
  }, [ms, onTimeout]);
}
