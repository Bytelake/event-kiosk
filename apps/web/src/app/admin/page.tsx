"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { SystemMetricsPanel } from "@/components/admin/system-metrics-panel";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardData {
  eventCounts: {
    total: number;
    published: number;
    hidden: number;
  };
  inquiryCount: number;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/events"), fetch("/api/inquiries")])
      .then(async ([eventsRes, inquiriesRes]) => {
        const events = await eventsRes.json();
        const inquiries = inquiriesRes.ok ? await inquiriesRes.json() : [];
        setData({
          eventCounts: {
            total: events.length,
            published: events.filter((e: { status: string }) => e.status === "published").length,
            hidden: events.filter((e: { kioskVisible: boolean }) => !e.kioskVisible).length,
          },
          inquiryCount: Array.isArray(inquiries) ? inquiries.length : 0,
        });
      });
  }, []);

  return (
    <AuthGuard>
      <AdminPage>
          <AdminPageHeader title="Dashboard" />

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total Events", data?.eventCounts.total],
              ["Published", data?.eventCounts.published],
              ["Hidden", data?.eventCounts.hidden],
              ["Inquiries", data?.inquiryCount],
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

          <div className="mt-8">
            <SystemMetricsPanel />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/admin/events">
              <Button>Manage Events</Button>
            </Link>
            <Link href="/admin/inquiries">
              <Button variant="secondary">View Inquiries</Button>
            </Link>
            <Link href="/admin/settings">
              <Button variant="secondary">Settings</Button>
            </Link>
          </div>
      </AdminPage>
    </AuthGuard>
  );
}
