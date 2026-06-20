# Breeze CHMS integration (archived)

Removed from the active app in v0.0.5. This folder preserves the Breeze calendar sync implementation for possible future restoration.

## What was removed

- Scheduled sync (every 20 minutes) and manual "Sync Now" on the admin dashboard
- Admin settings for Breeze subdomain, API key, and calendar selection
- `/api/breeze/sync` and `/api/breeze/calendars` API routes
- Breeze-specific event form restrictions (read-only title/dates for synced events)

## Database fields (unchanged)

Prisma schema still includes Breeze-related columns on `Event` and `Settings` so existing databases and backups remain compatible. Events previously synced from Breeze can be edited like manual events.

## To restore

1. Copy `lib/` back to `apps/web/src/lib/breeze/`
2. Copy `api/` routes back to `apps/web/src/app/api/breeze/`
3. Re-enable the scheduler in `apps/web/src/instrumentation.ts`
4. Restore admin UI, settings API fields, and README documentation
