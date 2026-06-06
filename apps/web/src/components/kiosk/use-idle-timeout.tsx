"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useIdleTimeout(onTimeout: () => void, ms: number) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function reset() {
      clearTimeout(timer);
      timer = setTimeout(onTimeout, ms);
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
