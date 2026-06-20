export type AdminTheme = "light" | "dark" | "system";

export const ADMIN_THEME_STORAGE_KEY = "kiosk-admin-theme";

export const ADMIN_THEME_OPTIONS: { value: AdminTheme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function readStoredAdminTheme(): AdminTheme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage may be unavailable
  }
  return "system";
}

export function resolveAdminTheme(theme: AdminTheme): "light" | "dark" {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyAdminThemeClass(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}
