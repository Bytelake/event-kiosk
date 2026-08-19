"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { format } from "date-fns";
import { eventIsAllDay, toDateLocalValue, toDatetimeLocalValue } from "@/lib/utils";
import { uploadImageFile } from "@/lib/upload-client";
import {
  extractRegistrationHostname,
  isRegistrationDomainAllowed,
  normalizeRegistrationUrl,
} from "@/lib/registration-domains";

interface EventFormProps {
  initial?: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}

export function EventForm({ initial, onSave, saving }: EventFormProps) {
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
    allDay: false,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [domainEnforcement, setDomainEnforcement] = useState(true);
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainMessage, setDomainMessage] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    Promise.all([
      fetch("/api/domains").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([domainData, settingsData]) => {
      if (Array.isArray(domainData)) {
        setAllowedDomains(domainData.map((d: { domain: string }) => d.domain));
      }
      setDomainEnforcement(settingsData.registrationDomainEnforcement ?? true);
    });
  }, []);

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
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }, [initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let imageUrl = form.imageUrl || null;
    if (pendingImageFile) {
      setUploading(true);
      setUploadError("");
      const result = await uploadImageFile(pendingImageFile);
      setUploading(false);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }

      imageUrl = result.url;
      setPendingImageFile(null);
      setImagePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setForm((f) => ({ ...f, imageUrl: result.url }));
    }

    await onSave({
      ...form,
      imageUrl,
      endAt: form.endAt || null,
      registrationUrl: form.registrationUrl
        ? normalizeRegistrationUrl(form.registrationUrl)
        : null,
      kioskVisible: form.status === "published",
    });
  }

  function handleImagePick(file: File) {
    setPendingImageFile(file);
    setUploadError("");
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleRemoveImage() {
    setPendingImageFile(null);
    setUploadError("");
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setForm((f) => ({ ...f, imageUrl: "" }));
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  const displayImageUrl = imagePreviewUrl ?? (form.imageUrl || null);
  const normalizedRegistrationUrl = form.registrationUrl
    ? normalizeRegistrationUrl(form.registrationUrl)
    : "";
  const registrationHostname = normalizedRegistrationUrl
    ? extractRegistrationHostname(normalizedRegistrationUrl)
    : null;
  const registrationDomainBlocked =
    domainEnforcement &&
    registrationHostname &&
    !isRegistrationDomainAllowed(normalizedRegistrationUrl, allowedDomains);

  async function addRegistrationDomain() {
    if (!registrationHostname) return;
    setAddingDomain(true);
    setDomainMessage("");

    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: registrationHostname }),
    });

    setAddingDomain(false);
    if (res.ok) {
      const domain = await res.json();
      setAllowedDomains((d) => [...d, domain.domain]);
      setDomainMessage(`Added ${domain.domain} to allowed registration domains`);
      return;
    }

    const body = await res.json().catch(() => ({}));
    setDomainMessage(body.error ? "Could not add domain" : "Domain already allowed");
  }

  function handleAllDayChange(checked: boolean) {
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
          <h2 className="font-semibold">Event Details</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
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
                onChange={(e) => handleStartChange(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">End</label>
              <Input
                type={form.allDay ? "date" : "datetime-local"}
                value={form.allDay ? toDateLocalValue(form.endAt) : form.endAt}
                onChange={(e) => handleEndChange(e.target.value)}
              />
            </div>
          </div>

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
              placeholder="signupgenius.com or https://..."
              onChange={(e) => {
                setForm({ ...form, registrationUrl: e.target.value });
                setDomainMessage("");
              }}
              onBlur={() => {
                if (!form.registrationUrl) return;
                const normalized = normalizeRegistrationUrl(form.registrationUrl);
                if (normalized !== form.registrationUrl) {
                  setForm((f) => ({ ...f, registrationUrl: normalized }));
                }
              }}
            />
            {registrationDomainBlocked && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <p>
                  <span className="font-medium">{registrationHostname}</span> is not in the
                  registration domain whitelist. The kiosk will block this link until the domain is
                  allowed.
                </p>
                <Button
                  type="button"
                  className="mt-2"
                  disabled={addingDomain}
                  onClick={() => void addRegistrationDomain()}
                >
                  {addingDomain ? "Adding..." : `Add ${registrationHostname}`}
                </Button>
              </div>
            )}
            {domainMessage && (
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{domainMessage}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Event image</label>
            <Input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImagePick(file);
              }}
            />
            {uploading && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Uploading...</p>}
            {uploadError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{uploadError}</p>
            )}
            {displayImageUrl ? (
              <div className="mt-3 flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={displayImageUrl} alt="Preview" className="h-40 rounded-xl object-cover" />
                <Button type="button" variant="ghost" onClick={handleRemoveImage}>
                  Remove
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
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
