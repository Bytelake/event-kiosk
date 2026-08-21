export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warnIfInsecureAuthConfig } = await import("@/lib/auth");
    warnIfInsecureAuthConfig();

    const { startArchivePastEventsScheduler } = await import(
      "@/lib/archive-past-events"
    );
    startArchivePastEventsScheduler();
  }
}
