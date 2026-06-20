import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
