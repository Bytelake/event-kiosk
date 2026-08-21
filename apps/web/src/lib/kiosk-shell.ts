"use client";

declare global {
  interface Window {
    kioskShell?: {
      openRegistration: (url: string, options?: { allowAnyDomain?: boolean }) => void;
      closeRegistration: () => void;
      notifyActivity?: () => void;
      onRegistrationClosed?: (callback: () => void) => () => void;
      isElectron: boolean;
    };
  }
}

export function openRegistration(url: string, options?: { allowAnyDomain?: boolean }) {
  if (window.kioskShell?.isElectron) {
    window.kioskShell.openRegistration(url, options);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export function closeRegistration() {
  window.kioskShell?.closeRegistration();
}

/** Subscribe to registration overlay close (Electron). Returns unsubscribe. */
export function onRegistrationClosed(callback: () => void): () => void {
  return window.kioskShell?.onRegistrationClosed?.(callback) ?? (() => {});
}

export function isElectronShell() {
  return Boolean(window.kioskShell?.isElectron);
}
