import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "lg" | "kiosk";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50",
          variant === "primary" && "bg-blue-600 text-white hover:bg-blue-700",
          variant === "secondary" && "bg-slate-100 text-slate-900 hover:bg-slate-200",
          variant === "ghost" && "bg-transparent text-slate-700 hover:bg-slate-100",
          variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
          size === "default" && "h-11 px-5 text-sm",
          size === "lg" && "h-14 px-8 text-lg",
          size === "kiosk" && "h-16 min-h-[64px] px-10 text-xl",
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
