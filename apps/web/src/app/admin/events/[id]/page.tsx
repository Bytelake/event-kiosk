"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AuthGuard } from "@/components/admin/login-form";
import { EventForm } from "@/components/admin/event-form";
import { Button } from "@/components/ui/button";

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${params.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setEvent);
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
        <div className="p-8 text-slate-500 dark:text-slate-400">Loading event...</div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AdminPage>
          <AdminPageHeader
            title="Edit Event"
            actions={
              <Button variant="danger" className="h-10 px-4 text-sm" onClick={handleDelete}>
                Delete
              </Button>
            }
          />
          <div className="mx-auto max-w-4xl">
          <EventForm initial={event} onSave={handleSave} saving={saving} />
          </div>
      </AdminPage>
    </AuthGuard>
  );
}
