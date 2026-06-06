export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBreezeSyncScheduler } = await import("@/lib/breeze/scheduler");
    startBreezeSyncScheduler();
  }
}
