"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  extractRegistrationHostname,
  isRegistrationDomainAllowed,
  normalizeRegistrationUrl,
} from "@/lib/registration-domains";

export interface PagesFormValues {
  newsletterEnabled: boolean;
  newsletterTitle: string;
  newsletterBody: string;
  newsletterUrl: string;
  givingEnabled: boolean;
  givingTitle: string;
  givingBody: string;
  givingSuccessMessage: string;
  givingNotifyEmail: string;
  givingVisitorEmailSubject: string;
  givingVisitorEmailBody: string;
}

interface PagesFormProps {
  initial: PagesFormValues;
  onSave: (values: PagesFormValues) => Promise<boolean>;
  saving: boolean;
  message: string;
  messageIsError?: boolean;
}

export function PagesForm({ initial, onSave, saving, message, messageIsError = false }: PagesFormProps) {
  const [form, setForm] = useState<PagesFormValues>(initial);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [domainEnforcement, setDomainEnforcement] = useState(true);
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainMessage, setDomainMessage] = useState("");

  useEffect(() => {
    setForm(initial);
  }, [initial]);

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

  const normalizedNewsletterUrl = form.newsletterUrl
    ? normalizeRegistrationUrl(form.newsletterUrl)
    : "";
  const newsletterHostname = normalizedNewsletterUrl
    ? extractRegistrationHostname(normalizedNewsletterUrl)
    : null;
  const newsletterDomainBlocked =
    domainEnforcement &&
    newsletterHostname &&
    !isRegistrationDomainAllowed(normalizedNewsletterUrl, allowedDomains);

  async function addNewsletterDomain() {
    if (!newsletterHostname) return;
    setAddingDomain(true);
    setDomainMessage("");

    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: newsletterHostname }),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newsletterUrl = form.newsletterUrl
      ? normalizeRegistrationUrl(form.newsletterUrl)
      : "";
    await onSave({ ...form, newsletterUrl });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Newsletter</h2>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.newsletterEnabled}
                onChange={(e) => setForm({ ...form, newsletterEnabled: e.target.checked })}
              />
              Show on kiosk
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <Input
              value={form.newsletterTitle}
              onChange={(e) => setForm({ ...form, newsletterTitle: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Intro</label>
            <Textarea
              value={form.newsletterBody}
              onChange={(e) => setForm({ ...form, newsletterBody: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Sign-up URL</label>
            <Input
              value={form.newsletterUrl}
              placeholder="mailchimp.com or https://..."
              onChange={(e) => {
                setForm({ ...form, newsletterUrl: e.target.value });
                setDomainMessage("");
              }}
              onBlur={() => {
                if (!form.newsletterUrl) return;
                const normalized = normalizeRegistrationUrl(form.newsletterUrl);
                if (normalized !== form.newsletterUrl) {
                  setForm((f) => ({ ...f, newsletterUrl: normalized }));
                }
              }}
            />
            {newsletterDomainBlocked && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <p>
                  <span className="font-medium">{newsletterHostname}</span> is not in the
                  registration domain whitelist. The kiosk will block this link until the domain is
                  allowed.
                </p>
                <Button
                  type="button"
                  className="mt-2 max-w-full"
                  disabled={addingDomain}
                  onClick={() => void addNewsletterDomain()}
                >
                  {addingDomain ? "Adding..." : `Add ${newsletterHostname}`}
                </Button>
              </div>
            )}
            {domainMessage && (
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{domainMessage}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Give</h2>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.givingEnabled}
                onChange={(e) => setForm({ ...form, givingEnabled: e.target.checked })}
              />
              Show on kiosk
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <Input
              value={form.givingTitle}
              onChange={(e) => setForm({ ...form, givingTitle: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Intro</label>
            <Textarea
              value={form.givingBody}
              onChange={(e) => setForm({ ...form, givingBody: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Success message</label>
            <Textarea
              value={form.givingSuccessMessage}
              onChange={(e) => setForm({ ...form, givingSuccessMessage: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Shown on the kiosk after a visitor submits the giving form.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Giving follow-up emails</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Staff-only settings. Not shown on the public kiosk.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Staff notify email</label>
            <Input
              type="email"
              value={form.givingNotifyEmail}
              placeholder="finance@example.org"
              onChange={(e) => setForm({ ...form, givingNotifyEmail: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Receives a copy when someone submits the giving form. Leave blank to skip staff
              notification.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Visitor email subject</label>
            <Input
              value={form.givingVisitorEmailSubject}
              onChange={(e) => setForm({ ...form, givingVisitorEmailSubject: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Visitor email body</label>
            <Textarea
              value={form.givingVisitorEmailBody}
              onChange={(e) => setForm({ ...form, givingVisitorEmailBody: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Sent to visitors after they submit the giving form when SMTP is configured.
            </p>
          </div>
        </CardContent>
      </Card>

      {message && (
        <p
          className={
            messageIsError
              ? "text-sm text-red-600 dark:text-red-400"
              : "text-sm text-emerald-700 dark:text-emerald-400"
          }
        >
          {message}
        </p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save Pages"}
      </Button>
    </form>
  );
}
