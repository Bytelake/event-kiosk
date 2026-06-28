export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startArchivePastEventsScheduler } = await import(
      "@/lib/archive-past-events"
    );
    startArchivePastEventsScheduler();
  }
}
