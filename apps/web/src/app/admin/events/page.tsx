"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatWallClockDateTime } from "@/lib/utils";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/card";

interface EventRow {
  id: string;
  title: string;
  startAt: string;
  status: string;
  syncStatus: string;
}

const tabs = [
  { key: "", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "archived", label: "Archived" },
];

function tabQuery(tab: string) {
  if (!tab) return "";
  return `?status=${tab}`;
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tab, setTab] = useState("");

  useEffect(() => {
    const query = tabQuery(tab);
    fetch(`/api/events${query}`)
      .then((res) => res.json())
      .then(setEvents);
  }, [tab]);

  return (
    <AuthGuard>
      <AdminPage>
          <AdminPageHeader title="Events" />

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
              <Button>Add Event</Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">{events.length} events</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {events.length === 0 && (
                <p className="text-slate-500 dark:text-slate-400">
                  No events found. Add an event to get started.
                </p>
              )}
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{event.title}</h3>
                      {event.syncStatus === "stale" && <Badge variant="warning">Stale</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {formatWallClockDateTime(event.startAt)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      event.status === "published"
                        ? "success"
                        : event.status === "draft"
                          ? "warning"
                          : "default"
                    }
                  >
                    {event.status}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
      </AdminPage>
    </AuthGuard>
  );
}
