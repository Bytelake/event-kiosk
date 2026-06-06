"use client";

declare global {
  interface Window {
    kioskShell?: {
      openRegistration: (url: string) => void;
      closeRegistration: () => void;
      isElectron: boolean;
    };
  }
}

export function openRegistration(url: string) {
  if (window.kioskShell?.isElectron) {
    window.kioskShell.openRegistration(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export function closeRegistration() {
  window.kioskShell?.closeRegistration();
}

export function isElectronShell() {
  return Boolean(window.kioskShell?.isElectron);
}
