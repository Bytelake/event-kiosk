"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
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
        className="rounded-lg px-4 py-2 text-sm font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      >
        Preview Kiosk
      </Link>
    </nav>
  );
}
