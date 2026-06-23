"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ThemeSelector } from "@/components/admin/theme-selector";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SystemAboutSection } from "@/components/admin/system-about-section";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SettingsForm {
  kioskIdleTimeoutSeconds: number;
  registrationDomainEnforcement: boolean;
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

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/domains").then((r) => r.json()),
    ]).then(([settingsData, domainData]) => {
      setSettings({
        kioskIdleTimeoutSeconds: settingsData.kioskIdleTimeoutSeconds ?? 60,
        registrationDomainEnforcement: settingsData.registrationDomainEnforcement ?? true,
      });
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
      kioskIdleTimeoutSeconds: settings.kioskIdleTimeoutSeconds,
      registrationDomainEnforcement: settings.registrationDomainEnforcement,
    };

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      setMessage("Settings saved");
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

      setSettings((current) =>
        current
          ? {
              ...current,
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
