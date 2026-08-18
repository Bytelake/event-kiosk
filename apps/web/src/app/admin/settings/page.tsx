"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ThemeSelector } from "@/components/admin/theme-selector";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SystemAboutSection } from "@/components/admin/system-about-section";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { parseDisplayOnDays, WEEKDAYS } from "@/lib/display-schedule";

interface SettingsForm {
  kioskIdleTimeoutSeconds: number;
  registrationDomainEnforcement: boolean;
  kioskDisplayEnabled: boolean;
  kioskDisplayScheduleEnabled: boolean;
  kioskDisplayOnDays: number[];
  kioskDisplayOnTime: string;
  kioskDisplayOffTime: string;
  kioskDisplayIdleOffMinutes: number;
}

interface DisplayPowerStatus {
  desiredOn: boolean;
  hardwareOn: boolean | null;
  available: boolean;
  method: string | null;
  error: string | null;
}

function toHhMm(value: string): string {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)/.exec(value.trim());
  if (!match) return value;
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

function settingsFromApi(settingsData: {
  kioskIdleTimeoutSeconds?: number;
  registrationDomainEnforcement?: boolean;
  kioskDisplayEnabled?: boolean;
  kioskDisplayScheduleEnabled?: boolean;
  kioskDisplayOnDays?: number[] | string;
  kioskDisplayOnTime?: string;
  kioskDisplayOffTime?: string;
  kioskDisplayIdleOffSeconds?: number;
}): SettingsForm {
  return {
    kioskIdleTimeoutSeconds: settingsData.kioskIdleTimeoutSeconds ?? 60,
    registrationDomainEnforcement: settingsData.registrationDomainEnforcement ?? true,
    kioskDisplayEnabled: settingsData.kioskDisplayEnabled ?? true,
    kioskDisplayScheduleEnabled: settingsData.kioskDisplayScheduleEnabled ?? false,
    kioskDisplayOnDays: parseDisplayOnDays(settingsData.kioskDisplayOnDays),
    kioskDisplayOnTime: settingsData.kioskDisplayOnTime ?? "07:00",
    kioskDisplayOffTime: settingsData.kioskDisplayOffTime ?? "22:00",
    kioskDisplayIdleOffMinutes: Math.round((settingsData.kioskDisplayIdleOffSeconds ?? 0) / 60),
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsForm | null>(null);
  const [domains, setDomains] = useState<{ id: string; domain: string }[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [message, setMessage] = useState("");
  const [displayStatus, setDisplayStatus] = useState<DisplayPowerStatus | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/domains").then((r) => r.json()),
    ]).then(([settingsData, domainData]) => {
      setSettings(settingsFromApi(settingsData));
      setDomains(domainData);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDisplayStatus() {
      try {
        const res = await fetch("/api/display/power");
        if (!res.ok) return;
        const data = (await res.json()) as DisplayPowerStatus;
        if (!cancelled) setDisplayStatus(data);
      } catch {
        // Ignore; status is informational.
      }
    }

    void loadDisplayStatus();
    const interval = setInterval(() => void loadDisplayStatus(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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
      kioskIdleTimeoutSeconds: settings.kioskIdleTimeoutSeconds,
      registrationDomainEnforcement: settings.registrationDomainEnforcement,
      kioskDisplayEnabled: settings.kioskDisplayEnabled,
      kioskDisplayScheduleEnabled: settings.kioskDisplayScheduleEnabled,
      kioskDisplayOnDays: settings.kioskDisplayOnDays,
      kioskDisplayOnTime: toHhMm(settings.kioskDisplayOnTime) || "07:00",
      kioskDisplayOffTime: toHhMm(settings.kioskDisplayOffTime) || "22:00",
      kioskDisplayIdleOffSeconds: Math.max(0, settings.kioskDisplayIdleOffMinutes) * 60,
    };

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      setMessage("Settings saved");
      const powerRes = await fetch("/api/display/power");
      if (powerRes.ok) {
        setDisplayStatus((await powerRes.json()) as DisplayPowerStatus);
      }
    }
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

  async function downloadExport(url: string, fallbackFilename: string, successMessage: string) {
    setExporting(true);
    setBackupMessage("");

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBackupMessage(body.error || "Export failed");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="(.+)"/)?.[1] ?? fallbackFilename;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setBackupMessage(successMessage);
    } catch {
      setBackupMessage("Export failed");
    } finally {
      setExporting(false);
    }
  }

  function handleExportFullBackup() {
    void downloadExport("/api/database/export", "kiosk-backup.zip", "Full backup exported");
  }

  function handleExportDatabaseOnly() {
    void downloadExport(
      "/api/database/export?format=db",
      "kiosk-backup.db",
      "Database exported (no media files)",
    );
  }

  async function handleImportDatabase(file: File) {
    if (
      !window.confirm(
        "Importing a backup replaces all events, settings, registration domains, and uploaded images. Continue?",
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
          (data.restoredUploadCount
            ? `; restored ${data.restoredUploadCount} uploaded images`
            : "") +
          (data.prunedUploadCount ? `; removed ${data.prunedUploadCount} unused uploads` : ""),
      );

      const [settingsRes, domainRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/domains"),
      ]);
      const settingsData = await settingsRes.json();
      const domainData = await domainRes.json();

      setSettings((current) => (current ? { ...current, ...settingsFromApi(settingsData) } : current));
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

        <div className="mx-auto mb-6 max-w-4xl">
          <SystemAboutSection />
        </div>

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
              <h2 className="font-semibold">Display output</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sleep the HDMI monitor while the kiosk PC stays on. This stops the video signal so
                the panel can power down and avoid burn-in.
              </p>
              {displayStatus && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {displayStatus.available
                    ? `Monitor is currently ${
                        displayStatus.hardwareOn === true
                          ? "on"
                          : displayStatus.hardwareOn === false
                            ? "asleep"
                            : "in an unknown state"
                      }${displayStatus.method ? ` (${displayStatus.method})` : ""}.`
                    : "Hardware display control is not available on this machine (normal during local development)."}
                  {displayStatus.error ? ` ${displayStatus.error}` : ""}
                </p>
              )}
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={settings.kioskDisplayEnabled}
                  onChange={(e) =>
                    setSettings((s) => (s ? { ...s, kioskDisplayEnabled: e.target.checked } : s))
                  }
                />
                <span>
                  <span className="font-medium">HDMI output enabled</span>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Uncheck, then save, to sleep the monitor immediately. The PC and admin site
                    keep running. Check and save again to wake the display.
                  </p>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={settings.kioskDisplayScheduleEnabled}
                  onChange={(e) =>
                    setSettings((s) =>
                      s ? { ...s, kioskDisplayScheduleEnabled: e.target.checked } : s,
                    )
                  }
                />
                <span>
                  <span className="font-medium">Use a weekly schedule</span>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Keep the monitor on during the hours below on selected days (defaults to
                    Sunday). Other days stay off unless someone touches the screen.
                  </p>
                </span>
              </label>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  On these days
                </p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const checked = settings.kioskDisplayOnDays.includes(day.value);
                    return (
                      <label
                        key={day.value}
                        className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm ${
                          settings.kioskDisplayScheduleEnabled
                            ? "cursor-pointer border-slate-200 dark:border-slate-700"
                            : "cursor-not-allowed border-slate-100 text-slate-400 dark:border-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mr-2"
                          disabled={!settings.kioskDisplayScheduleEnabled}
                          checked={checked}
                          onChange={(e) =>
                            setSettings((s) => {
                              if (!s) return s;
                              const next = e.target.checked
                                ? [...s.kioskDisplayOnDays, day.value]
                                : s.kioskDisplayOnDays.filter((value) => value !== day.value);
                              return {
                                ...s,
                                kioskDisplayOnDays:
                                  next.length > 0 ? next.sort((a, b) => a - b) : s.kioskDisplayOnDays,
                              };
                            })
                          }
                        />
                        {day.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Wake at
                  </label>
                  <Input
                    type="time"
                    value={settings.kioskDisplayOnTime}
                    disabled={!settings.kioskDisplayScheduleEnabled}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, kioskDisplayOnTime: e.target.value } : s))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Sleep at
                  </label>
                  <Input
                    type="time"
                    value={settings.kioskDisplayOffTime}
                    disabled={!settings.kioskDisplayScheduleEnabled}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, kioskDisplayOffTime: e.target.value } : s))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Sleep after idle (minutes)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  value={settings.kioskDisplayIdleOffMinutes}
                  onChange={(e) =>
                    setSettings((s) =>
                      s
                        ? {
                            ...s,
                            kioskDisplayIdleOffMinutes: Math.max(0, Number(e.target.value) || 0),
                          }
                        : s,
                    )
                  }
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  On unscheduled days the monitor stays off until someone touches it, then sleeps
                  again after this many minutes. During scheduled on hours it stays on. Set to 0 to
                  leave the monitor off on unscheduled days.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Registration Domains</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={settings.registrationDomainEnforcement}
                  onChange={(e) =>
                    setSettings((s) =>
                      s ? { ...s, registrationDomainEnforcement: e.target.checked } : s,
                    )
                  }
                />
                <span>
                  <span className="font-medium">Enforce registration domain whitelist</span>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    When enabled, the kiosk only opens HTTPS registration links from the domains
                    below (plus common providers like SignUpGenius and Eventbrite). Turn off to
                    allow any HTTPS registration URL.
                  </p>
                </span>
              </label>
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
              <h2 className="font-semibold">Backup &amp; Restore</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                <p>
                  Use <span className="font-medium text-slate-700 dark:text-slate-300">Export Full Backup</span>{" "}
                  when moving to a new machine or restoring after a wipe. The zip includes the
                  database plus uploaded event images, logos, and kiosk backgrounds (up to 2 GB).
                </p>
                <p>
                  Use <span className="font-medium text-slate-700 dark:text-slate-300">Export Database Only</span>{" "}
                  for a lightweight SQLite snapshot of events, settings, and registration domains.
                  Image paths are stored in the database, but the files themselves are not included —
                  imported images will be missing unless the uploads folder is copied separately.
                </p>
                <p>
                  Import accepts either a full backup (.zip) or a database-only file (.db). Full
                  backups restore media automatically; database-only imports replace data but not
                  uploaded files.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={handleExportFullBackup} disabled={exporting}>
                  {exporting ? "Exporting..." : "Export Full Backup"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleExportDatabaseOnly}
                  disabled={exporting}
                >
                  {exporting ? "Exporting..." : "Export Database Only"}
                </Button>
                <label className="inline-flex">
                  <input
                    type="file"
                    accept=".zip,.db,application/zip,application/x-sqlite3,application/vnd.sqlite3,application/octet-stream"
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
                    {importing ? "Importing..." : "Import Backup"}
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
