"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { kioskBackgroundStyles } from "@/lib/validators";
import type { KioskBackgroundStyle } from "@/lib/kiosk-api";

interface Calendar {
  id: number | string;
  name: string;
}

interface SettingsForm {
  orgName: string;
  orgLogoUrl: string;
  brandPrimaryColor: string;
  kioskBackgroundStyle: KioskBackgroundStyle;
  breezeSubdomain: string;
  breezeApiKey: string;
  breezeCalendarIds: string[];
  hasBreezeApiKey: boolean;
}

const backgroundLabels: Record<KioskBackgroundStyle, string> = {
  clean: "Clean — simple light gradient",
  "brand-glow": "Brand glow — soft color wash from your brand",
  dots: "Dots — subtle patterned texture",
  aurora: "Aurora — flowing gradient accents",
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsForm | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [domains, setDomains] = useState<{ id: string; domain: string }[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/breeze/calendars").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/domains").then((r) => r.json()),
    ]).then(([settingsData, calendarData, domainData]) => {
      setSettings({
        orgName: settingsData.orgName,
        orgLogoUrl: settingsData.orgLogoUrl ?? "",
        brandPrimaryColor: settingsData.brandPrimaryColor,
        kioskBackgroundStyle: settingsData.kioskBackgroundStyle ?? "clean",
        breezeSubdomain: settingsData.breezeSubdomain ?? "",
        breezeApiKey: "",
        breezeCalendarIds: settingsData.breezeCalendarIds ?? [],
        hasBreezeApiKey: settingsData.hasBreezeApiKey,
      });
      setCalendars(calendarData);
      setDomains(domainData);
    });
  }, []);

  if (!settings) {
    return (
      <AuthGuard>
        <div className="p-8 text-slate-500">Loading settings...</div>
      </AuthGuard>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage("");

    const payload: Record<string, unknown> = {
      orgName: settings.orgName,
      orgLogoUrl: settings.orgLogoUrl || null,
      brandPrimaryColor: settings.brandPrimaryColor,
      kioskBackgroundStyle: settings.kioskBackgroundStyle,
      breezeSubdomain: settings.breezeSubdomain || null,
      breezeCalendarIds: settings.breezeCalendarIds,
    };
    if (settings.breezeApiKey) {
      payload.breezeApiKey = settings.breezeApiKey;
    }

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      setMessage("Settings saved");
      setSettings((s) => ({ ...s!, breezeApiKey: "", hasBreezeApiKey: true }));
    }
  }

  function toggleCalendar(id: string) {
    setSettings((s) => {
      if (!s) return s;
      const selected = s.breezeCalendarIds.includes(id)
        ? s.breezeCalendarIds.filter((c) => c !== id)
        : [...s.breezeCalendarIds, id];
      return { ...s, breezeCalendarIds: selected };
    });
  }

  async function addDomain() {
    if (!newDomain) return;
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: newDomain }),
    });
    if (res.ok) {
      const domain = await res.json();
      setDomains((d) => [...d, domain]);
      setNewDomain("");
    }
  }

  async function removeDomain(id: string) {
    await fetch(`/api/domains?id=${id}`, { method: "DELETE" });
    setDomains((d) => d.filter((item) => item.id !== id));
  }

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body });
    setLogoUploading(false);
    if (res.ok) {
      const data = await res.json();
      setSettings((s) => (s ? { ...s, orgLogoUrl: data.url } : s));
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-8">
            <AdminNav />
            <h1 className="mt-4 text-3xl font-bold text-slate-900">Settings</h1>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Organization Branding</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Organization name"
                  value={settings.orgName}
                  onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
                />

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Logo</label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                  />
                  {logoUploading && <p className="mt-1 text-sm text-slate-500">Uploading...</p>}
                  {settings.orgLogoUrl ? (
                    <div className="mt-3 flex items-start gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={settings.orgLogoUrl}
                        alt="Logo preview"
                        className="h-20 w-auto rounded-lg border border-slate-200 bg-white object-contain p-2"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSettings({ ...settings, orgLogoUrl: "" })}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">PNG or SVG recommended</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Brand color
                  </label>
                  <Input
                    type="color"
                    value={settings.brandPrimaryColor}
                    onChange={(e) =>
                      setSettings({ ...settings, brandPrimaryColor: e.target.value })
                    }
                    className="h-12 w-24"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Kiosk background
                  </label>
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm"
                    value={settings.kioskBackgroundStyle}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        kioskBackgroundStyle: e.target.value as KioskBackgroundStyle,
                      })
                    }
                  >
                    {kioskBackgroundStyles.map((style) => (
                      <option key={style} value={style}>
                        {backgroundLabels[style]}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-semibold">Breeze CHMS</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Breeze subdomain (e.g. yourchurch)"
                  value={settings.breezeSubdomain}
                  onChange={(e) =>
                    setSettings({ ...settings, breezeSubdomain: e.target.value })
                  }
                />
                <Input
                  type="password"
                  placeholder={
                    settings.hasBreezeApiKey
                      ? "API key configured (enter to replace)"
                      : "Breeze API key"
                  }
                  value={settings.breezeApiKey}
                  onChange={(e) => setSettings({ ...settings, breezeApiKey: e.target.value })}
                />
                {calendars.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">Calendars to sync</p>
                    <div className="space-y-2">
                      {calendars.map((calendar) => {
                        const id = String(calendar.id);
                        return (
                          <label
                            key={id}
                            className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                          >
                            <input
                              type="checkbox"
                              checked={settings.breezeCalendarIds.includes(id)}
                              onChange={() => toggleCalendar(id)}
                            />
                            <span>{calendar.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Leave all unchecked to sync every calendar.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-semibold">Registration Domains</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="signupgenius.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                  />
                  <Button type="button" onClick={addDomain}>
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {domains.map((domain) => (
                    <div
                      key={domain.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2"
                    >
                      <span>{domain.domain}</span>
                      <Button type="button" variant="ghost" onClick={() => removeDomain(domain.id)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {message && <p className="text-sm text-emerald-700">{message}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </div>
      </div>
    </AuthGuard>
  );
}
