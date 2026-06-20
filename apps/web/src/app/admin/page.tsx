"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardData {
  eventCounts: {
    total: number;
    published: number;
    hidden: number;
  };
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((events) => {
        setData({
          eventCounts: {
            total: events.length,
            published: events.filter((e: { status: string }) => e.status === "published").length,
            hidden: events.filter((e: { kioskVisible: boolean }) => !e.kioskVisible).length,
          },
        });
      });
  }, []);

  return (
    <AuthGuard>
      <div className="mx-auto max-w-6xl px-6 py-8">
          <AdminPageHeader title="Dashboard" />

          <div className="grid gap-6 md:grid-cols-3">
            {[
              ["Total Events", data?.eventCounts.total],
              ["Published", data?.eventCounts.published],
              ["Hidden", data?.eventCounts.hidden],
            ].map(([label, value]) => (
              <Card key={label as string}>
                <CardContent>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {value ?? "—"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <Link href="/admin/events">
              <Button>Manage Events</Button>
            </Link>
            <Link href="/admin/settings">
              <Button variant="secondary">Settings</Button>
            </Link>
          </div>
      </div>
    </AuthGuard>
  );
}
