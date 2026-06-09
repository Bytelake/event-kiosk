"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatWallClockDateTime } from "@/lib/utils";
import { AdminNav } from "@/components/admin/admin-nav";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/card";

interface EventRow {
  id: string;
  title: string;
  startAt: string;
  source: string;
  status: string;
  kioskVisible: boolean;
  syncStatus: string;
}

const tabs = [
  { key: "", label: "All" },
  { key: "breeze", label: "Breeze" },
  { key: "manual", label: "Manual" },
  { key: "hidden", label: "Hidden" },
];

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tab, setTab] = useState("");

  useEffect(() => {
    const query = tab ? `?source=${tab}` : "";
    fetch(`/api/events${query}`)
      .then((res) => res.json())
      .then(setEvents);
  }, [tab]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Events</h1>
              <p className="text-slate-500">Enrich Breeze events or create manual entries</p>
            </div>
            <AdminNav />
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {tabs.map((item) => (
              <Button
                key={item.key}
                variant={tab === item.key ? "primary" : "secondary"}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </Button>
            ))}
            <Link href="/admin/events/new" className="ml-auto">
              <Button>Add Manual Event</Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">{events.length} events</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {events.length === 0 && (
                <p className="text-slate-500">No events found. Run a Breeze sync to import events.</p>
              )}
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{event.title}</h3>
                      {event.source === "breeze" && <Badge variant="breeze">Breeze</Badge>}
                      {!event.kioskVisible && <Badge variant="warning">Hidden</Badge>}
                      {event.syncStatus === "stale" && <Badge variant="warning">Stale</Badge>}
                    </div>
                    <p className="text-sm text-slate-500">
                      {formatWallClockDateTime(event.startAt)}
                    </p>
                  </div>
                  <Badge variant={event.status === "published" ? "success" : "default"}>
                    {event.status}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}
