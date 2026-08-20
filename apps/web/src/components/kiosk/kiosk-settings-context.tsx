"use client";

import { createContext, useContext } from "react";
import type { KioskSettings } from "@/lib/kiosk-api";

const KioskSettingsContext = createContext<KioskSettings | null>(null);

export function KioskSettingsProvider({
  settings,
  children,
}: {
  settings: KioskSettings | null;
  children: React.ReactNode;
}) {
  return (
    <KioskSettingsContext.Provider value={settings}>{children}</KioskSettingsContext.Provider>
  );
}

export function useKioskSettings(): KioskSettings | null {
  return useContext(KioskSettingsContext);
}
