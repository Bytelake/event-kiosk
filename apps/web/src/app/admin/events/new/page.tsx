"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
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
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-8">
            <AdminNav />
            <h1 className="mt-4 text-3xl font-bold text-slate-900">New Manual Event</h1>
          </div>
          <EventForm onSave={handleSave} saving={saving} isBreeze={false} />
        </div>
      </div>
    </AuthGuard>
  );
}
