"use client";

import { useEffect, useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AuthGuard } from "@/components/admin/login-form";
import { PagesForm, type PagesFormValues } from "@/components/admin/pages-form";

function pagesFromApi(settingsData: Record<string, unknown>): PagesFormValues {
  return {
    newsletterEnabled: Boolean(settingsData.newsletterEnabled ?? true),
    newsletterTitle: String(settingsData.newsletterTitle ?? "Newsletter"),
    newsletterBody: String(
      settingsData.newsletterBody ?? "Stay connected. Sign up for our newsletter.",
    ),
    newsletterUrl: String(settingsData.newsletterUrl ?? ""),
    newsletterButtonLabel: String(settingsData.newsletterButtonLabel ?? "Sign up"),
    givingEnabled: Boolean(settingsData.givingEnabled ?? true),
    givingTitle: String(settingsData.givingTitle ?? "Give"),
    givingBody: String(
      settingsData.givingBody ??
        "Share your contact information and we will follow up with ways to give.",
    ),
    givingSuccessMessage: String(
      settingsData.givingSuccessMessage ??
        "Thank you. We will follow up with giving information.",
    ),
    givingNotifyEmail: String(settingsData.givingNotifyEmail ?? ""),
    givingVisitorEmailSubject: String(settingsData.givingVisitorEmailSubject ?? "How to give"),
    givingVisitorEmailBody: String(
      settingsData.givingVisitorEmailBody ??
        "Thank you for your interest in giving. We will follow up with information about how to give.",
    ),
  };
}

export default function AdminPagesPage() {
  const [settings, setSettings] = useState<PagesFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((settingsData) => setSettings(pagesFromApi(settingsData)));
  }, []);

  if (!settings) {
    return (
      <AuthGuard>
        <div className="p-8 text-slate-500 dark:text-slate-400">Loading pages...</div>
      </AuthGuard>
    );
  }

  async function handleSave(values: PagesFormValues): Promise<boolean> {
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newsletterEnabled: values.newsletterEnabled,
        newsletterTitle: values.newsletterTitle,
        newsletterBody: values.newsletterBody,
        newsletterUrl: values.newsletterUrl,
        newsletterButtonLabel: values.newsletterButtonLabel,
        givingEnabled: values.givingEnabled,
        givingTitle: values.givingTitle,
        givingBody: values.givingBody,
        givingSuccessMessage: values.givingSuccessMessage,
        givingNotifyEmail: values.givingNotifyEmail,
        givingVisitorEmailSubject: values.givingVisitorEmailSubject,
        givingVisitorEmailBody: values.givingVisitorEmailBody,
      }),
    });

    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      setSettings(pagesFromApi(saved));
      setMessage("Pages saved");
      return true;
    }
    return false;
  }

  return (
    <AuthGuard>
      <AdminPage>
        <AdminPageHeader title="Pages" />
        <PagesForm
          initial={settings}
          onSave={handleSave}
          saving={saving}
          message={message}
        />
      </AdminPage>
    </AuthGuard>
  );
}
