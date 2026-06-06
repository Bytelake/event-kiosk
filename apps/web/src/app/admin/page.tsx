"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/card";
import { format } from "date-fns";

interface DashboardData {
  lastBreezeSyncAt: string | null;
  lastBreezeSyncError: string | null;
  eventCounts: {
    total: number;
    published: number;
    breeze: number;
    hidden: number;
  };
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDashboard() {
    const [settingsRes, eventsRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/events"),
    ]);
    const settings = await settingsRes.json();
    const events = await eventsRes.json();

    setData({
      lastBreezeSyncAt: settings.lastBreezeSyncAt,
      lastBreezeSyncError: settings.lastBreezeSyncError,
      eventCounts: {
        total: events.length,
        published: events.filter((e: { status: string }) => e.status === "published").length,
        breeze: events.filter((e: { source: string }) => e.source === "breeze").length,
        hidden: events.filter((e: { kioskVisible: boolean }) => !e.kioskVisible).length,
      },
    });
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setMessage("");
    const res = await fetch("/api/breeze/sync", { method: "POST" });
    const body = await res.json();
    setSyncing(false);

    if (!res.ok) {
      setMessage(body.error || "Sync failed");
      return;
    }

    setMessage(
      `Synced ${body.total} events (${body.created} new, ${body.updated} updated, ${body.stale} stale)`,
    );
    loadDashboard();
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500">Manage your event kiosk</p>
            </div>
            <AdminNav />
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total Events", data?.eventCounts.total],
              ["Published", data?.eventCounts.published],
              ["From Breeze", data?.eventCounts.breeze],
              ["Hidden", data?.eventCounts.hidden],
            ].map(([label, value]) => (
              <Card key={label as string}>
                <CardContent>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{value ?? "—"}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Breeze Sync</h2>
                  <p className="text-sm text-slate-500">
                    Last sync:{" "}
                    {data?.lastBreezeSyncAt
                      ? format(new Date(data.lastBreezeSyncAt), "MMM d, yyyy h:mm a")
                      : "Never"}
                  </p>
                </div>
                <Button onClick={handleSync} disabled={syncing}>
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data?.lastBreezeSyncError && (
                <p className="mb-3 text-sm text-red-600">{data.lastBreezeSyncError}</p>
              )}
              {message && <p className="text-sm text-emerald-700">{message}</p>}
              <p className="mt-4 text-sm text-slate-500">
                New Breeze events are imported as drafts and hidden from the kiosk until you enrich
                and publish them.
              </p>
            </CardContent>
          </Card>

          <div className="mt-6 flex gap-3">
            <Link href="/admin/events">
              <Button>Manage Events</Button>
            </Link>
            <Link href="/admin/settings">
              <Button variant="secondary">Settings</Button>
            </Link>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
