"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ColorField } from "@/components/admin/color-field";
import { FontField } from "@/components/admin/font-field";
import { KioskBrandingPreview } from "@/components/admin/kiosk-branding-preview";
import { AuthGuard } from "@/components/admin/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { defaultKioskColorScheme, type KioskColorScheme } from "@/lib/kiosk-colors";
import {
  defaultKioskBackgroundStyle,
  type KioskBackgroundStyle,
} from "@/lib/kiosk-background";
import {
  defaultKioskFonts,
  type KioskFontScheme,
  KIOSK_PRIMARY_FONT_PRESETS,
  KIOSK_SECONDARY_FONT_PRESETS,
  ensureGoogleFontsPreviewLink,
} from "@/lib/kiosk-fonts";
import { uploadImageFile } from "@/lib/upload-client";

interface BrandingForm extends KioskColorScheme, KioskFontScheme {
  orgName: string;
  orgLogoUrl: string;
  kioskShowLogo: boolean;
  kioskShowOrgName: boolean;
  kioskBackgroundAnimated: boolean;
  kioskBackgroundStyle: KioskBackgroundStyle;
  kioskBackgroundImageUrl: string;
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
    description: "Base color in the background gradient",
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

export default function AdminBrandingPage() {
  const [settings, setSettings] = useState<BrandingForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [pendingBackgroundFile, setPendingBackgroundFile] = useState<File | null>(null);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
      if (backgroundPreviewUrl) {
        URL.revokeObjectURL(backgroundPreviewUrl);
      }
    };
  }, [logoPreviewUrl, backgroundPreviewUrl]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((settingsData) => {
        setSettings({
          orgName: settingsData.orgName,
          orgLogoUrl: settingsData.orgLogoUrl ?? "",
          kioskShowLogo: settingsData.kioskShowLogo ?? true,
          kioskShowOrgName: settingsData.kioskShowOrgName ?? true,
          brandPrimaryColor:
            settingsData.brandPrimaryColor ?? defaultKioskColorScheme.brandPrimaryColor,
          brandSecondaryColor:
            settingsData.brandSecondaryColor ?? defaultKioskColorScheme.brandSecondaryColor,
          kioskBackgroundColor:
            settingsData.kioskBackgroundColor ?? defaultKioskColorScheme.kioskBackgroundColor,
          kioskTextColor: settingsData.kioskTextColor ?? defaultKioskColorScheme.kioskTextColor,
          kioskMutedTextColor:
            settingsData.kioskMutedTextColor ?? defaultKioskColorScheme.kioskMutedTextColor,
          kioskPrimaryFont: settingsData.kioskPrimaryFont ?? defaultKioskFonts.kioskPrimaryFont,
          kioskSecondaryFont:
            settingsData.kioskSecondaryFont ?? defaultKioskFonts.kioskSecondaryFont,
          kioskBackgroundAnimated: settingsData.kioskBackgroundAnimated ?? true,
          kioskBackgroundStyle:
            settingsData.kioskBackgroundStyle ?? defaultKioskBackgroundStyle,
          kioskBackgroundImageUrl: settingsData.kioskBackgroundImageUrl ?? "",
        });
      });
  }, []);

  useEffect(() => {
    if (!settings) return;
    ensureGoogleFontsPreviewLink(
      "admin-kiosk-font-preview",
      settings.kioskPrimaryFont,
      settings.kioskSecondaryFont,
    );
  }, [settings?.kioskPrimaryFont, settings?.kioskSecondaryFont, settings]);

  if (!settings) {
    return (
      <AuthGuard>
        <div className="p-8 text-slate-500 dark:text-slate-400">Loading branding...</div>
      </AuthGuard>
    );
  }

  const displayLogoUrl = logoPreviewUrl ?? (settings.orgLogoUrl || null);
  const displayBackgroundUrl =
    backgroundPreviewUrl ?? (settings.kioskBackgroundImageUrl || null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage("");

    let orgLogoUrl = settings.orgLogoUrl || null;
    if (pendingLogoFile) {
      const result = await uploadImageFile(pendingLogoFile);
      if (!result.ok) {
        setSaving(false);
        setMessage(result.error);
        return;
      }

      orgLogoUrl = result.url;
      setPendingLogoFile(null);
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }

    let kioskBackgroundImageUrl = settings.kioskBackgroundImageUrl || null;
    if (pendingBackgroundFile) {
      const result = await uploadImageFile(pendingBackgroundFile);
      if (!result.ok) {
        setSaving(false);
        setMessage(result.error);
        return;
      }

      kioskBackgroundImageUrl = result.url;
      setPendingBackgroundFile(null);
      setBackgroundPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }

    if (settings.kioskBackgroundStyle === "image" && !kioskBackgroundImageUrl) {
      setSaving(false);
      setMessage("Upload a background image or switch to the gradient style");
      return;
    }

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgName: settings.orgName,
        orgLogoUrl,
        kioskShowLogo: settings.kioskShowLogo,
        kioskShowOrgName: settings.kioskShowOrgName,
        brandPrimaryColor: settings.brandPrimaryColor,
        brandSecondaryColor: settings.brandSecondaryColor,
        kioskBackgroundColor: settings.kioskBackgroundColor,
        kioskTextColor: settings.kioskTextColor,
        kioskMutedTextColor: settings.kioskMutedTextColor,
        kioskPrimaryFont: settings.kioskPrimaryFont,
        kioskSecondaryFont: settings.kioskSecondaryFont,
        kioskBackgroundAnimated: settings.kioskBackgroundAnimated,
        kioskBackgroundStyle: settings.kioskBackgroundStyle,
        kioskBackgroundImageUrl,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setMessage("Branding saved");
      setSettings((s) => ({
        ...s!,
        orgLogoUrl: orgLogoUrl ?? "",
        kioskBackgroundImageUrl: kioskBackgroundImageUrl ?? "",
      }));
    }
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

  function handleBackgroundPick(file: File) {
    setPendingBackgroundFile(file);
    setBackgroundPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleRemoveBackground() {
    setPendingBackgroundFile(null);
    setBackgroundPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSettings((s) => (s ? { ...s, kioskBackgroundImageUrl: "" } : s));
  }

  return (
    <AuthGuard>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <AdminPageHeader title="Branding" />

        <form onSubmit={handleSave} className="mx-auto max-w-4xl space-y-6">
          <KioskBrandingPreview
            orgName={settings.orgName}
            logoUrl={displayLogoUrl}
            showLogo={settings.kioskShowLogo}
            showOrgName={settings.kioskShowOrgName}
            colors={{
              brandPrimaryColor: settings.brandPrimaryColor,
              brandSecondaryColor: settings.brandSecondaryColor,
              kioskBackgroundColor: settings.kioskBackgroundColor,
              kioskTextColor: settings.kioskTextColor,
              kioskMutedTextColor: settings.kioskMutedTextColor,
            }}
            fonts={{
              kioskPrimaryFont: settings.kioskPrimaryFont,
              kioskSecondaryFont: settings.kioskSecondaryFont,
            }}
          />

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Organization</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Organization name"
                value={settings.orgName}
                onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
              />
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={settings.kioskShowOrgName}
                  onChange={(e) =>
                    setSettings({ ...settings, kioskShowOrgName: e.target.checked })
                  }
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Show organization name on kiosk
                </span>
              </label>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Logo
                </label>
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
                      className="h-20 w-auto rounded-lg border border-slate-200 bg-white object-contain p-2 dark:border-slate-700 dark:bg-slate-900"
                    />
                    <Button type="button" variant="ghost" onClick={handleRemoveLogo}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    PNG or SVG recommended
                  </p>
                )}
                <label className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={settings.kioskShowLogo}
                    onChange={(e) =>
                      setSettings({ ...settings, kioskShowLogo: e.target.checked })
                    }
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Show logo on kiosk
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Fonts</h2>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <FontField
                  label="Primary font"
                  description="Headings and display text"
                  value={settings.kioskPrimaryFont}
                  onChange={(kioskPrimaryFont) =>
                    setSettings({ ...settings, kioskPrimaryFont })
                  }
                  presets={KIOSK_PRIMARY_FONT_PRESETS}
                  previewLinkId="admin-kiosk-font-preview-primary"
                  previewRole="primary"
                />
                <FontField
                  label="Secondary font"
                  description="Body text, buttons, and labels"
                  value={settings.kioskSecondaryFont}
                  onChange={(kioskSecondaryFont) =>
                    setSettings({ ...settings, kioskSecondaryFont })
                  }
                  presets={KIOSK_SECONDARY_FONT_PRESETS}
                  previewLinkId="admin-kiosk-font-preview-secondary"
                  previewRole="secondary"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Background</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Style
                </legend>
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <input
                    type="radio"
                    name="kioskBackgroundStyle"
                    className="mt-0.5"
                    checked={settings.kioskBackgroundStyle === "gradient"}
                    onChange={() =>
                      setSettings({ ...settings, kioskBackgroundStyle: "gradient" })
                    }
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-medium">Animated gradient</span>
                    <span className="mt-1 block text-slate-500 dark:text-slate-400">
                      Brand-colored gradient that shifts slowly across the screen.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <input
                    type="radio"
                    name="kioskBackgroundStyle"
                    className="mt-0.5"
                    checked={settings.kioskBackgroundStyle === "image"}
                    onChange={() =>
                      setSettings({ ...settings, kioskBackgroundStyle: "image" })
                    }
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-medium">Background image</span>
                    <span className="mt-1 block text-slate-500 dark:text-slate-400">
                      Upload a photo. It is blurred and darkened so kiosk content stays readable.
                    </span>
                  </span>
                </label>
              </fieldset>

              {settings.kioskBackgroundStyle === "image" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Background image
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBackgroundPick(file);
                    }}
                  />
                  {displayBackgroundUrl ? (
                    <div className="mt-3 flex items-start gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayBackgroundUrl}
                        alt="Background preview"
                        className="h-24 w-auto max-w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                      />
                      <Button type="button" variant="ghost" onClick={handleRemoveBackground}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      JPG or PNG recommended. Required when using the image style.
                    </p>
                  )}
                </div>
              )}

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={settings.kioskBackgroundAnimated}
                  onChange={(e) =>
                    setSettings({ ...settings, kioskBackgroundAnimated: e.target.checked })
                  }
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-medium">Animate background</span>
                  <span className="mt-1 block text-slate-500 dark:text-slate-400">
                    {settings.kioskBackgroundStyle === "image"
                      ? "When on, the background photo slowly zooms. Turn off on low-power hardware if you notice sustained GPU use."
                      : "When on, the gradient shifts continuously. Turn off on low-power hardware if you notice sustained GPU use."}
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Colors</h2>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {colorFields.map((field) => (
                  <ColorField
                    key={field.key}
                    label={field.label}
                    description={field.description}
                    value={settings[field.key]}
                    onChange={(value) => setSettings({ ...settings, [field.key]: value })}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {message && <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Branding"}
          </Button>
        </form>
      </div>
    </AuthGuard>
  );
}
