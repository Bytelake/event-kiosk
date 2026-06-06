"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { AuthGuard } from "@/components/admin/login-form";
import { EventForm } from "@/components/admin/event-form";
import { Button } from "@/components/ui/button";

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/events`)
      .then((res) => res.json())
      .then((events) => {
        const found = events.find((e: { id: string }) => e.id === params.id);
        setEvent(found ?? null);
      });
  }, [params.id]);

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/events?id=${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setEvent(updated);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this event?")) return;
    await fetch(`/api/events?id=${params.id}`, { method: "DELETE" });
    router.push("/admin/events");
  }

  if (!event) {
    return (
      <AuthGuard>
        <div className="p-8 text-slate-500">Loading event...</div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <AdminNav />
              <h1 className="mt-4 text-3xl font-bold text-slate-900">Edit Event</h1>
            </div>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
          <EventForm
            initial={event}
            onSave={handleSave}
            saving={saving}
            isBreeze={event.source === "breeze"}
          />
        </div>
      </div>
    </AuthGuard>
  );
}
