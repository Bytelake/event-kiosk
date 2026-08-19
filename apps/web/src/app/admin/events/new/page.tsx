"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AuthGuard } from "@/components/admin/login-form";
import { EventForm } from "@/components/admin/event-form";

export default function NewEventPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Could not save event");
      }
      router.push(`/admin/events/${body.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard>
      <div className="mx-auto max-w-6xl px-6 py-8">
          <AdminPageHeader title="New Event" />
          <div className="mx-auto max-w-4xl">
          <EventForm onSave={handleSave} saving={saving} />
          </div>
      </div>
    </AuthGuard>
  );
}
