"use client";

import { useEffect, useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/card";
import { formatWallClockDateTime } from "@/lib/utils";

interface InquiryRow {
  id: string;
  kind: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  emailStatus: string;
  createdAt: string;
}

async function downloadCsv() {
  const res = await fetch("/api/inquiries/export");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Export failed");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename = disposition?.match(/filename="(.+)"/)?.[1] ?? "inquiries.csv";
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  useEffect(() => {
    fetch("/api/inquiries")
      .then(async (res) => {
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      })
      .then(setInquiries);
  }, []);

  async function handleExport() {
    setExporting(true);
    setExportMessage("");

    try {
      await downloadCsv();
      setExportMessage("CSV exported");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
      window.setTimeout(() => setExportMessage(""), 3000);
    }
  }

  return (
    <AuthGuard>
      <AdminPage>
        <AdminPageHeader title="Inquiries" />
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
          Submissions from the kiosk giving form. Email status stays skipped until SMTP follow-up
          ships; use this list (or Export CSV) to contact visitors.
        </p>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button onClick={handleExport} disabled={exporting} variant="secondary">
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
          {exportMessage ? (
            <span className="text-sm text-slate-600 dark:text-slate-400">{exportMessage}</span>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">{inquiries.length} inquiries</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {inquiries.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400">
                No inquiries yet. Submissions from the kiosk giving form will appear here.
              </p>
            )}
            {inquiries.map((inquiry) => (
              <div
                key={inquiry.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {inquiry.name}
                      </h3>
                      <Badge variant="default">{inquiry.kind}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {inquiry.email}
                      {inquiry.phone ? ` · ${inquiry.phone}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {formatWallClockDateTime(inquiry.createdAt)}
                    </p>
                    {inquiry.message ? (
                      <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                        {inquiry.message}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      inquiry.emailStatus === "sent"
                        ? "success"
                        : inquiry.emailStatus === "failed"
                          ? "warning"
                          : "default"
                    }
                  >
                    {inquiry.emailStatus}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </AdminPage>
    </AuthGuard>
  );
}
