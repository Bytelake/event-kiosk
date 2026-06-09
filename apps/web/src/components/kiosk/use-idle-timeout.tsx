"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useIdleTimeout(onTimeout: () => void, ms: number | null) {
  const router = useRouter();

  useEffect(() => {
    if (ms === null) return;

    const timeoutMs = ms;
    let timer: ReturnType<typeof setTimeout>;

    function reset() {
      clearTimeout(timer);
      timer = setTimeout(onTimeout, timeoutMs);
    }

    const events = ["touchstart", "mousedown", "keydown", "scroll"];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [ms, onTimeout, router]);
}
