import { AdminNav } from "./admin-nav";

export function AdminPageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
      <h1 className="min-w-0 truncate text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
        {title}
      </h1>
      <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 sm:gap-3">
        {actions}
        <AdminNav />
      </div>
    </div>
  );
}
