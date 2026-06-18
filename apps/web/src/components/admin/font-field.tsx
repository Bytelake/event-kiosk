"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  KIOSK_FONT_CUSTOM_VALUE,
  ensureGoogleFontsPreviewLink,
  kioskFontStyle,
} from "@/lib/kiosk-fonts";

type FontPreset = { label: string; family: string };

function isPresetFamily(family: string, presets: readonly FontPreset[]): boolean {
  return presets.some((preset) => preset.family === family);
}

export function FontField({
  label,
  description,
  value,
  onChange,
  presets,
  previewLinkId,
  previewRole,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  presets: readonly FontPreset[];
  previewLinkId: string;
  previewRole: "primary" | "secondary";
}) {
  const [customMode, setCustomMode] = useState(() => !isPresetFamily(value, presets));
  const [customValue, setCustomValue] = useState(() =>
    isPresetFamily(value, presets) ? "" : value,
  );

  useEffect(() => {
    if (!value.trim()) return;
    ensureGoogleFontsPreviewLink(previewLinkId, value, value);
  }, [previewLinkId, value]);

  const selectValue = customMode ? KIOSK_FONT_CUSTOM_VALUE : value;
  const previewStyle =
    previewRole === "primary"
      ? {
          fontFamily: kioskFontStyle({
            kioskPrimaryFont: value,
            kioskSecondaryFont: value,
          })["--font-kiosk-display"],
        }
      : {
          fontFamily: kioskFontStyle({
            kioskPrimaryFont: value,
            kioskSecondaryFont: value,
          })["--font-kiosk-ui"],
        };

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3">
        <p className="font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <select
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === KIOSK_FONT_CUSTOM_VALUE) {
            setCustomMode(true);
            if (customValue.trim()) {
              onChange(customValue.trim());
            }
            return;
          }
          setCustomMode(false);
          onChange(next);
        }}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
      >
        {presets.map((preset) => (
          <option key={preset.family} value={preset.family}>
            {preset.label}
          </option>
        ))}
        <option value={KIOSK_FONT_CUSTOM_VALUE}>Custom Google Font…</option>
      </select>
      {customMode && (
        <div className="mt-3 space-y-2">
          <Input
            value={customValue}
            onChange={(e) => {
              const next = e.target.value;
              setCustomValue(next);
              if (next.trim()) {
                onChange(next.trim());
              }
            }}
            placeholder="e.g. Roboto Slab"
          />
          <p className="text-xs text-slate-500">
            Enter any family name from{" "}
            <a
              href="https://fonts.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              Google Fonts
            </a>
            .
          </p>
        </div>
      )}
      <p className="mt-3 text-lg text-slate-800" style={previewStyle}>
        The quick brown fox jumps over the lazy dog
      </p>
    </div>
  );
}
