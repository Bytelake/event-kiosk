"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              pathname === link.href
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-100",
            )}
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/kiosk"
          target="_blank"
          className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
        >
          Preview Kiosk
        </Link>
      </nav>
      <button
        type="button"
        onClick={refreshDisplay}
        disabled={refreshing}
        className="rounded-lg bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
      >
        {refreshing ? "Refreshing..." : "Refresh Display"}
      </button>
      {refreshMessage ? (
        <span className="text-sm text-violet-700">{refreshMessage}</span>
      ) : null}
    </div>
  );
}
