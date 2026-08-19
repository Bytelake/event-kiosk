import { cn } from "@/lib/utils";

export function AdminPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8", className)}>
      {children}
    </div>
  );
}
