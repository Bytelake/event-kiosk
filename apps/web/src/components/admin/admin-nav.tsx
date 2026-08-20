"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/branding", label: "Branding" },
  { href: "/admin/settings", label: "Settings" },
];

const itemClass =
  "block w-full rounded-lg px-4 py-2 text-sm font-medium transition lg:inline-flex lg:w-auto lg:whitespace-nowrap";

export function AdminNav() {
  const pathname = usePathname();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 lg:hidden"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <div
        id={menuId}
        className={cn(
          "z-50 flex-col gap-2",
          "absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900",
          menuOpen ? "flex" : "hidden",
          "lg:static lg:mt-0 lg:flex lg:w-auto lg:max-w-none lg:flex-row lg:flex-wrap lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
        )}
      >
        <nav className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                itemClass,
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
            onClick={() => setMenuOpen(false)}
            className={cn(
              itemClass,
              "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900",
            )}
          >
            Preview Kiosk
          </Link>
        </nav>
        <button
          type="button"
          onClick={toggleDisplay}
          disabled={togglingDisplay || displayEnabled === null}
          className={cn(
            itemClass,
            "bg-amber-50 text-left text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900",
          )}
        >
          {togglingDisplay
            ? displayEnabled
              ? "Sleeping..."
              : "Waking..."
            : displayEnabled === false
              ? "Wake Display"
              : "Sleep Display"}
        </button>
        {displayMessage ? (
          <span className="px-2 text-sm text-amber-800 dark:text-amber-200">{displayMessage}</span>
        ) : null}
        <button
          type="button"
          onClick={refreshDisplay}
          disabled={refreshing}
          className={cn(
            itemClass,
            "bg-violet-50 text-left text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:bg-violet-950 dark:text-violet-300 dark:hover:bg-violet-900",
          )}
        >
          {refreshing ? "Refreshing..." : "Refresh Display"}
        </button>
        {refreshMessage ? (
          <span className="px-2 text-sm text-violet-700 dark:text-violet-300">{refreshMessage}</span>
        ) : null}
      </div>
    </div>
  );
}
