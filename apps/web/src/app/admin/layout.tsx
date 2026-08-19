import { AdminThemeProvider } from "@/components/admin/admin-theme-provider";
import { ADMIN_THEME_STORAGE_KEY } from "@/lib/admin-theme";

const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem("${ADMIN_THEME_STORAGE_KEY}");
    var dark =
      theme === "dark" ||
      (theme !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      <AdminThemeProvider>
        <div className="min-h-screen overflow-x-clip bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          {children}
        </div>
      </AdminThemeProvider>
    </>
  );
}
