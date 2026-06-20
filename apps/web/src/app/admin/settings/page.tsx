"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ThemeSelector } from "@/components/admin/theme-selector";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface Calendar {
  id: number | string;
  name: string;
}

interface SettingsForm {
  breezeSubdomain: string;
  breezeApiKey: string;
  breezeCalendarIds: string[];
  hasBreezeApiKey: boolean;
  kioskIdleTimeoutSeconds: number;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsForm | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [domains, setDomains] = useState<{ id: string; domain: string }[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/breeze/calendars").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/domains").then((r) => r.json()),
    ]).then(([settingsData, calendarData, domainData]) => {
      setSettings({
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
        <div className="p-8 text-slate-500 dark:text-slate-400">Loading settings...</div>
      </AuthGuard>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage("");

    const payload: Record<string, unknown> = {
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
      const filename = disposition?.match(/filename="(.+)"/)?.[1] ?? "kiosk-backup.db";
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
      <div className="mx-auto max-w-6xl px-6 py-8">
        <AdminPageHeader title="Settings" />

        <form onSubmit={handleSave} className="mx-auto max-w-4xl space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Appearance</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Admin theme
              </label>
              <ThemeSelector />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose light, dark, or match your system setting.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Kiosk Behavior</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Return to the events home screen after this many seconds without touch or scroll
                  input. Set to 0 to disable.
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
                onChange={(e) => setSettings({ ...settings, breezeSubdomain: e.target.value })}
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
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Calendars to sync
                  </p>
                  <div className="space-y-2">
                    {calendars.map((calendar) => {
                      const id = String(calendar.id);
                      return (
                        <label
                          key={id}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
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
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
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
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2 dark:border-slate-700"
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
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Export the SQLite database for backup or migration. Importing replaces all events,
                settings, and registration domains with the backup file.
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
                    className={`inline-flex h-10 cursor-pointer items-center rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${
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
                    backupMessage.endsWith("failed")
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {backupMessage}
                </p>
              )}
            </CardContent>
          </Card>

          {message && <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </div>
    </AuthGuard>
  );
}
