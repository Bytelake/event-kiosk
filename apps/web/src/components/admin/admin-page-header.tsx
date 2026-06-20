import { AdminNav } from "./admin-nav";

export function AdminPageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-center justify-between gap-x-6 gap-y-3">
      <h1 className="min-w-0 text-3xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
      <div className="flex shrink-0 items-center gap-3">
        {actions}
        <AdminNav />
      </div>
    </div>
  );
}
