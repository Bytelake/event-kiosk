"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/card";
import { format } from "date-fns";
import { eventIsAllDay, toDateLocalValue, toDatetimeLocalValue } from "@/lib/utils";
import { uploadImageFile } from "@/lib/upload-client";

interface EventFormProps {
  initial?: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  isBreeze: boolean;
}

export function EventForm({ initial, onSave, saving, isBreeze }: EventFormProps) {
  const [form, setForm] = useState({
    title: "",
    startAt: "",
    endAt: "",
    shortDescription: "",
    fullDescription: "",
    location: "",
    imageUrl: "",
    registrationUrl: "",
    featured: false,
    status: "draft",
    sortOrder: 0,
    breezeDescription: "",
    allDay: false,
  });
  const [uploading, setUploading] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    if (!initial) return;
    const startAt = initial.startAt ? toDatetimeLocalValue(String(initial.startAt)) : "";
    const endAt = initial.endAt ? toDatetimeLocalValue(String(initial.endAt)) : "";
    setForm({
      title: String(initial.title ?? ""),
      startAt,
      endAt,
      shortDescription: String(initial.shortDescription ?? ""),
      fullDescription: String(initial.fullDescription ?? ""),
      location: String(initial.location ?? ""),
      imageUrl: String(initial.imageUrl ?? ""),
      registrationUrl: String(initial.registrationUrl ?? ""),
      featured: Boolean(initial.featured),
      status: String(initial.status ?? "draft"),
      sortOrder: Number(initial.sortOrder ?? 0),
      breezeDescription: String(initial.breezeDescription ?? ""),
      allDay: eventIsAllDay(
        initial.allDay as boolean | undefined,
        startAt || String(initial.startAt ?? ""),
        endAt || (initial.endAt ? String(initial.endAt) : null),
      ),
    });
    setPendingImageFile(null);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let imageUrl = form.imageUrl || null;
    if (pendingImageFile) {
      setUploading(true);
      const url = await uploadImageFile(pendingImageFile);
      setUploading(false);
      if (!url) return;

      imageUrl = url;
      setPendingImageFile(null);
      setImagePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setForm((f) => ({ ...f, imageUrl: url }));
    }

    await onSave({
      ...form,
      imageUrl,
      endAt: form.endAt || null,
      registrationUrl: form.registrationUrl || null,
      kioskVisible: form.status === "published",
    });
  }

  function handleImagePick(file: File) {
    setPendingImageFile(file);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  const displayImageUrl = imagePreviewUrl ?? (form.imageUrl || null);

  function handleAllDayChange(checked: boolean) {
    if (isBreeze) {
      setForm((f) => ({ ...f, allDay: checked }));
      return;
    }

    setForm((f) => {
      if (checked) {
        return {
          ...f,
          allDay: true,
          startAt: f.startAt ? `${f.startAt.slice(0, 10)}T00:00` : f.startAt,
          endAt: f.endAt ? `${f.endAt.slice(0, 10)}T00:00` : f.endAt,
        };
      }

      return {
        ...f,
        allDay: false,
        startAt: f.startAt ? `${f.startAt.slice(0, 10)}T09:00` : f.startAt,
        endAt: f.endAt ? `${f.endAt.slice(0, 10)}T17:00` : f.endAt,
      };
    });
  }

  function handleStartChange(value: string) {
    setForm((f) => ({
      ...f,
      startAt: f.allDay ? `${value}T00:00` : value,
    }));
  }

  function handleEndChange(value: string) {
    setForm((f) => ({
      ...f,
      endAt: f.allDay ? `${value}T00:00` : value,
    }));
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Event Details</h2>
            {isBreeze && <Badge variant="breeze">Synced from Breeze</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <Input
              value={form.title}
              disabled={isBreeze}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            {isBreeze && (
              <p className="mt-1 text-xs text-slate-500">
                Updated automatically from Breeze on sync
              </p>
            )}
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => handleAllDayChange(e.target.checked)}
            />
            <span>All day</span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Start</label>
              <Input
                type={form.allDay ? "date" : "datetime-local"}
                value={form.allDay ? toDateLocalValue(form.startAt) : form.startAt}
                disabled={isBreeze}
                onChange={(e) => handleStartChange(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">End</label>
              <Input
                type={form.allDay ? "date" : "datetime-local"}
                value={form.allDay ? toDateLocalValue(form.endAt) : form.endAt}
                disabled={isBreeze}
                onChange={(e) => handleEndChange(e.target.value)}
              />
            </div>
          </div>

          {isBreeze && form.breezeDescription && (
            <div className="rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
              <p className="font-medium">Breeze description (reference only)</p>
              <p className="mt-1 whitespace-pre-wrap">{form.breezeDescription}</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Short description</label>
            <Input
              value={form.shortDescription}
              onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Full description</label>
            <Textarea
              value={form.fullDescription}
              onChange={(e) => setForm({ ...form, fullDescription: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Location</label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Registration URL</label>
            <Input
              value={form.registrationUrl}
              placeholder="https://www.signupgenius.com/..."
              onChange={(e) => setForm({ ...form, registrationUrl: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Event image</label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImagePick(file);
              }}
            />
            {uploading && <p className="mt-1 text-sm text-slate-500">Uploading...</p>}
            {displayImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayImageUrl} alt="Preview" className="mt-3 h-40 rounded-xl object-cover" />
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 px-4"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Sort order</label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />
            <span>Featured on kiosk home</span>
          </label>

          {initial?.lastSyncedAt ? (
            <p className="text-xs text-slate-500">
              Last synced: {format(new Date(String(initial.lastSyncedAt)), "MMM d, yyyy h:mm a")}
            </p>
          ) : null}

          <Button type="submit" disabled={saving || uploading}>
            {saving || uploading ? "Saving..." : "Save Event"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
