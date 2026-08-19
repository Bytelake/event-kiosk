"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AuthGuard } from "@/components/admin/login-form";
import { EventForm } from "@/components/admin/event-form";

export default function NewEventPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (!res.ok) return;
    const event = await res.json();
    router.push(`/admin/events/${event.id}`);
  }

  return (
    <AuthGuard>
      <AdminPage>
          <AdminPageHeader title="New Event" />
          <div className="mx-auto max-w-4xl">
          <EventForm onSave={handleSave} saving={saving} />
          </div>
      </AdminPage>
    </AuthGuard>
  );
}
