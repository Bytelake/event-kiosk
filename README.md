**This project generated with the use of Cursor**

# Event Information & Registration Kiosk

A Linux kiosk application for displaying organization events synced from **Breeze CHMS**, with admin-enriched details and embedded registration via external sites (SignupGenius, Eventbrite, etc.).

## Features

- **Breeze CHMS sync** — imports event title and date; admins add images, descriptions, and registration links
- **Touch-optimized kiosk UI** — designed for 24–32" displays with large tap targets
- **Admin backend** — manage events, Breeze settings, branding, and allowed registration domains
- **Electron shell** — fullscreen lockdown with embedded registration browser and domain whitelist
- **Linux deployment** — systemd services, autologin, and lockdown scripts

## Requirements

- **Node.js 20.9+** (recommended for Next.js 16)
- Linux (Ubuntu / Raspberry Pi OS) for production kiosk deployment
- Breeze CHMS API key and subdomain

## Quick Start (Development)

```bash
# Install dependencies
npm install
cd apps/shell && npm install && cd ../..

# Configure environment
cp apps/web/.env.example apps/web/.env
# Edit apps/web/.env — set ADMIN_PASSWORD and SESSION_SECRET

# Initialize database
npm run db:push --workspace=web
npm run db:seed --workspace=web

# Start web app
npm run dev

# In another terminal, start Electron shell (optional)
npm run dev:shell
```

Open:
- Kiosk: http://localhost:3000/kiosk
- Admin: http://localhost:3000/admin/login (default password: `changeme`)

## Environment Variables

Create `apps/web/.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite path, e.g. `file:./dev.db` |
| `ADMIN_PASSWORD` | Admin login password (plain text or bcrypt hash) |
| `SESSION_SECRET` | Random string for session JWT signing |
| `BREEZE_SUBDOMAIN` | Optional; can also set in admin Settings |
| `BREEZE_API_KEY` | Optional; can also set in admin Settings |

Electron shell:

| Variable | Description |
|----------|-------------|
| `KIOSK_URL` | URL to load (default `http://localhost:3000/kiosk`) |

## Breeze CHMS Setup

1. In Breeze, go to **Account → API** and copy your API key and subdomain
2. In admin **Settings**, enter subdomain and API key
3. Select calendars to sync (or leave all unchecked to sync everything)
4. Click **Sync Now** on the dashboard
5. Edit imported events — add image, description, registration URL, and publish

Breeze-owned fields (title, date) update on each sync. Admin-enriched fields are never overwritten.

## Production Deployment (Linux)

1. Copy project to `/opt/kiosk`
2. Install Node.js 20.9+, build the web app:

```bash
cd /opt/kiosk
npm install
npm run db:push --workspace=web
npm run db:seed --workspace=web
npm run build --workspace=web
npm run build --workspace=shell
```

3. Configure `apps/web/.env` with production secrets
4. Run lockdown script as root:

```bash
sudo bash /opt/kiosk/deploy/linux/lockdown.sh
sudo systemctl start kiosk-web kiosk-shell
```

### Optional: Cage compositor (single-app Wayland)

Install `cage` and autologin the `kiosk` user into a session that runs only the Electron shell for stronger OS lockdown.

## Project Structure

```
apps/web/          Next.js kiosk UI, admin UI, API, Breeze sync
apps/shell/        Electron kiosk shell
deploy/linux/      systemd units and lockdown script
prisma/            Database schema (in apps/web)
```

## Registration Domains

Default allowed domains include SignupGenius and Eventbrite. Add more in **Admin → Settings**. The Electron shell blocks navigation to non-whitelisted HTTPS domains.

## License

Private — for organization use.
