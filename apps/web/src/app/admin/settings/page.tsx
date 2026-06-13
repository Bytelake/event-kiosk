"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { defaultKioskColorScheme, type KioskColorScheme } from "@/lib/kiosk-colors";
import { uploadImageFile } from "@/lib/upload-client";

interface Calendar {
  id: number | string;
  name: string;
}

interface SettingsForm extends KioskColorScheme {
  orgName: string;
  orgLogoUrl: string;
  breezeSubdomain: string;
  breezeApiKey: string;
  breezeCalendarIds: string[];
  hasBreezeApiKey: boolean;
  kioskIdleTimeoutSeconds: number;
}

const colorFields: { key: keyof KioskColorScheme; label: string; description: string }[] = [
  {
    key: "brandPrimaryColor",
    label: "Primary",
    description: "Buttons, accents, and badge highlights",
  },
  {
    key: "brandSecondaryColor",
    label: "Secondary",
    description: "Event card gradients when no image is set",
  },
  {
    key: "kioskBackgroundColor",
    label: "Background",
    description: "Page background gradient start",
  },
  {
    key: "kioskTextColor",
    label: "Heading text",
    description: "Titles and section headers",
  },
  {
    key: "kioskMutedTextColor",
    label: "Muted text",
    description: "Subtitles and secondary labels",
  },
];

function ColorField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3">
        <p className="font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-16 shrink-0 cursor-pointer p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#2563eb"
          className="font-mono uppercase"
        />
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsForm | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [domains, setDomains] = useState<{ id: string; domain: string }[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/breeze/calendars").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/domains").then((r) => r.json()),
    ]).then(([settingsData, calendarData, domainData]) => {
      setSettings({
        orgName: settingsData.orgName,
        orgLogoUrl: settingsData.orgLogoUrl ?? "",
        brandPrimaryColor: settingsData.brandPrimaryColor ?? defaultKioskColorScheme.brandPrimaryColor,
        brandSecondaryColor:
          settingsData.brandSecondaryColor ?? defaultKioskColorScheme.brandSecondaryColor,
        kioskBackgroundColor:
          settingsData.kioskBackgroundColor ?? defaultKioskColorScheme.kioskBackgroundColor,
        kioskTextColor: settingsData.kioskTextColor ?? defaultKioskColorScheme.kioskTextColor,
        kioskMutedTextColor:
          settingsData.kioskMutedTextColor ?? defaultKioskColorScheme.kioskMutedTextColor,
        breezeSubdomain: settingsData.breezeSubdomain ?? "",
        breezeApiKey: "",
        breezeCalendarIds: settingsData.breezeCalendarIds ?? [],
        hasBreezeApiKey: settingsData.hasBreezeApiKey,
        kioskIdleTimeoutSeconds: settingsData.kioskIdleTimeoutSeconds ?? 60,
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

  const displayLogoUrl = logoPreviewUrl ?? (settings.orgLogoUrl || null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage("");

    let orgLogoUrl = settings.orgLogoUrl || null;
    if (pendingLogoFile) {
      const url = await uploadImageFile(pendingLogoFile);
      if (!url) {
        setSaving(false);
        setMessage("Logo upload failed");
        return;
      }

      orgLogoUrl = url;
      setPendingLogoFile(null);
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }

    const payload: Record<string, unknown> = {
      orgName: settings.orgName,
      orgLogoUrl,
      brandPrimaryColor: settings.brandPrimaryColor,
      brandSecondaryColor: settings.brandSecondaryColor,
      kioskBackgroundColor: settings.kioskBackgroundColor,
      kioskTextColor: settings.kioskTextColor,
      kioskMutedTextColor: settings.kioskMutedTextColor,
      breezeSubdomain: settings.breezeSubdomain || null,
      breezeCalendarIds: settings.breezeCalendarIds,
      kioskIdleTimeoutSeconds: settings.kioskIdleTimeoutSeconds,
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
      setSettings((s) => ({
        ...s!,
        orgLogoUrl: orgLogoUrl ?? "",
        breezeApiKey: "",
        hasBreezeApiKey: true,
      }));
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

  function handleLogoPick(file: File) {
    setPendingLogoFile(file);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleRemoveLogo() {
    setPendingLogoFile(null);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSettings((s) => (s ? { ...s, orgLogoUrl: "" } : s));
  }

  async function handleExportDatabase() {
    setExporting(true);
    setBackupMessage("");

    try {
      const res = await fetch("/api/database/export");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBackupMessage(body.error || "Export failed");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filename =
        disposition?.match(/filename="(.+)"/)?.[1] ?? "kiosk-backup.db";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setBackupMessage("Database exported");
    } catch {
      setBackupMessage("Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleImportDatabase(file: File) {
    if (
      !window.confirm(
        "Importing a backup replaces all events, settings, and registration domains. Continue?",
      )
    ) {
      return;
    }

    setImporting(true);
    setBackupMessage("");

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/database/import", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        setBackupMessage(data.error || "Import failed");
        return;
      }

      setBackupMessage(
        `Imported ${data.eventCount} events and ${data.domainCount} registration domains` +
          (data.prunedUploadCount ? `; removed ${data.prunedUploadCount} unused uploads` : ""),
      );

      setPendingLogoFile(null);
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      const [settingsRes, domainRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/domains"),
      ]);
      const settingsData = await settingsRes.json();
      const domainData = await domainRes.json();

      setSettings((current) =>
        current
          ? {
              ...current,
              orgName: settingsData.orgName,
              orgLogoUrl: settingsData.orgLogoUrl ?? "",
              brandPrimaryColor:
                settingsData.brandPrimaryColor ?? defaultKioskColorScheme.brandPrimaryColor,
              brandSecondaryColor:
                settingsData.brandSecondaryColor ??
                defaultKioskColorScheme.brandSecondaryColor,
              kioskBackgroundColor:
                settingsData.kioskBackgroundColor ??
                defaultKioskColorScheme.kioskBackgroundColor,
              kioskTextColor:
                settingsData.kioskTextColor ?? defaultKioskColorScheme.kioskTextColor,
              kioskMutedTextColor:
                settingsData.kioskMutedTextColor ??
                defaultKioskColorScheme.kioskMutedTextColor,
              breezeSubdomain: settingsData.breezeSubdomain ?? "",
              breezeCalendarIds: settingsData.breezeCalendarIds ?? [],
              hasBreezeApiKey: settingsData.hasBreezeApiKey,
              kioskIdleTimeoutSeconds: settingsData.kioskIdleTimeoutSeconds ?? 60,
            }
          : current,
      );
      setDomains(domainData);
    } catch {
      setBackupMessage("Import failed");
    } finally {
      setImporting(false);
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
                      if (file) handleLogoPick(file);
                    }}
                  />
                  {displayLogoUrl ? (
                    <div className="mt-3 flex items-start gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayLogoUrl}
                        alt="Logo preview"
                        className="h-20 w-auto rounded-lg border border-slate-200 bg-white object-contain p-2"
                      />
                      <Button type="button" variant="ghost" onClick={handleRemoveLogo}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">PNG or SVG recommended</p>
                  )}
                </div>

                <div>
                  <label className="mb-3 block text-sm font-medium text-slate-700">
                    Kiosk color scheme
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    {colorFields.map((field) => (
                      <ColorField
                        key={field.key}
                        label={field.label}
                        description={field.description}
                        value={settings[field.key]}
                        onChange={(value) =>
                          setSettings({ ...settings, [field.key]: value })
                        }
                      />
                    ))}
                  </div>
                  <div
                    className="mt-4 overflow-hidden rounded-2xl border border-slate-200"
                    style={{
                      background: `linear-gradient(to bottom, ${settings.kioskBackgroundColor}, #ffffff)`,
                    }}
                  >
                    <div className="p-6">
                      <p
                        className="text-sm font-medium"
                        style={{ color: settings.kioskMutedTextColor }}
                      >
                        {settings.orgName || "Organization name"}
                      </p>
                      <p
                        className="mt-1 text-2xl font-bold"
                        style={{ color: settings.kioskTextColor }}
                      >
                        Upcoming Events
                      </p>
                      <div
                        className="mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-white"
                        style={{ backgroundColor: settings.brandPrimaryColor }}
                      >
                        Register
                      </div>
                      <div
                        className="mt-4 h-16 max-w-xs rounded-2xl"
                        style={{
                          background: `linear-gradient(to bottom right, ${settings.brandPrimaryColor}, ${settings.brandSecondaryColor})`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-semibold">Kiosk Behavior</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Idle timeout (seconds)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={3600}
                    value={settings.kioskIdleTimeoutSeconds}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        kioskIdleTimeoutSeconds: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Return to the events home screen after this many seconds without touch or
                    scroll input. Set to 0 to disable.
                  </p>
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

            <Card>
              <CardHeader>
                <h2 className="font-semibold">Database Backup</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-500">
                  Export the SQLite database for backup or migration. Importing replaces all
                  events, settings, and registration domains with the backup file.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={handleExportDatabase} disabled={exporting}>
                    {exporting ? "Exporting..." : "Export Database"}
                  </Button>
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept=".db,application/x-sqlite3,application/vnd.sqlite3,application/octet-stream"
                      className="hidden"
                      disabled={importing}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void handleImportDatabase(file);
                        }
                        e.target.value = "";
                      }}
                    />
                    <span
                      className={`inline-flex h-10 cursor-pointer items-center rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-200 ${
                        importing ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      {importing ? "Importing..." : "Import Database"}
                    </span>
                  </label>
                </div>
                {backupMessage && (
                  <p
                    className={`text-sm ${
                      backupMessage.endsWith("failed") ? "text-red-600" : "text-emerald-700"
                    }`}
                  >
                    {backupMessage}
                  </p>
                )}
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
