"use client";

import { ADMIN_THEME_OPTIONS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";
import { useAdminTheme } from "./admin-theme-provider";

export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme } = useAdminTheme();

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900",
        className,
      )}
      role="group"
      aria-label="Color theme"
    >
      {ADMIN_THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setTheme(option.value)}
          aria-pressed={theme === option.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition",
            theme === option.value
              ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
