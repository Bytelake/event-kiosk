import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function KioskBackButton({
  href = "/kiosk",
  label = "Back",
  overlay = false,
}: {
  href?: string;
  label?: string;
  overlay?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "kiosk-glass-panel inline-flex h-16 w-16 items-center justify-center rounded-full text-[var(--kiosk-text)] transition active:scale-95",
        overlay && "absolute left-5 top-10 z-10 md:left-8",
      )}
    >
      <ArrowLeft className="h-[22px] w-[22px]" />
    </Link>
  );
}
