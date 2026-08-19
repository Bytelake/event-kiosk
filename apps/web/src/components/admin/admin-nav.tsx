"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/branding", label: "Branding" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [displayEnabled, setDisplayEnabled] = useState<boolean | null>(null);
  const [togglingDisplay, setTogglingDisplay] = useState(false);
  const [displayMessage, setDisplayMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDisplay() {
      try {
        const res = await fetch("/api/display/power");
        if (!res.ok) return;
        const data = (await res.json()) as { enabled?: boolean };
        if (!cancelled && typeof data.enabled === "boolean") {
          setDisplayEnabled(data.enabled);
        }
      } catch {
        // Ignore; button stays in default until the next action.
      }
    }

    void loadDisplay();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshDisplay() {
    setRefreshing(true);
    setRefreshMessage("");

    try {
      const res = await fetch("/api/display/refresh", { method: "POST" });
      if (!res.ok) {
        setRefreshMessage("Refresh failed");
        return;
      }
      setRefreshMessage("Display refresh sent");
    } catch {
      setRefreshMessage("Refresh failed");
    } finally {
      setRefreshing(false);
      window.setTimeout(() => setRefreshMessage(""), 3000);
    }
  }

  async function toggleDisplay() {
    if (displayEnabled === null) return;
    const nextEnabled = !displayEnabled;
    setTogglingDisplay(true);
    setDisplayMessage("");

    try {
      const res = await fetch("/api/display/power", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (!res.ok) {
        setDisplayMessage(nextEnabled ? "Wake failed" : "Sleep failed");
        return;
      }
      const data = (await res.json()) as { enabled?: boolean; error?: string | null };
      setDisplayEnabled(data.enabled ?? nextEnabled);
      setDisplayMessage(nextEnabled ? "Display waking" : "Display sleeping");
    } catch {
      setDisplayMessage(nextEnabled ? "Wake failed" : "Sleep failed");
    } finally {
      setTogglingDisplay(false);
      window.setTimeout(() => setDisplayMessage(""), 3000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <nav className="flex items-center gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              pathname === link.href
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
            )}
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/kiosk"
          target="_blank"
          className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
        >
          Preview Kiosk
        </Link>
      </nav>
      <button
        type="button"
        onClick={toggleDisplay}
        disabled={togglingDisplay || displayEnabled === null}
        className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
      >
        {togglingDisplay
          ? displayEnabled
            ? "Sleeping..."
            : "Waking..."
          : displayEnabled === false
            ? "Wake Display"
            : "Sleep Display"}
      </button>
      <button
        type="button"
        onClick={refreshDisplay}
        disabled={refreshing}
        className="rounded-lg bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50 dark:bg-violet-950 dark:text-violet-300 dark:hover:bg-violet-900"
      >
        {refreshing ? "Refreshing..." : "Refresh Display"}
      </button>
      {displayMessage ? (
        <span className="text-sm text-amber-800 dark:text-amber-200">{displayMessage}</span>
      ) : null}
      {refreshMessage ? (
        <span className="text-sm text-violet-700 dark:text-violet-300">{refreshMessage}</span>
      ) : null}
    </div>
  );
}
