import cron from "node-cron";
import { syncBreezeEvents } from "./sync";

let started = false;

export function startBreezeSyncScheduler() {
  if (started || process.env.NODE_ENV === "test") return;
  started = true;

  cron.schedule("*/20 * * * *", async () => {
    try {
      await syncBreezeEvents();
      console.log("[breeze-sync] Scheduled sync completed");
    } catch (error) {
      console.error("[breeze-sync] Scheduled sync failed:", error);
    }
  });
}
