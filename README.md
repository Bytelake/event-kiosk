**This project generated with the use of Cursor**

# Event Kiosk

Touchscreen kiosk for church events synced from **Breeze CHMS**. Admins add images, descriptions, and registration links; visitors browse events and sign up through embedded registration sites.

Designed for **Raspberry Pi OS Lite** (no desktop required). Also runs on other Linux systems or locally for development.

## Features

- Breeze CHMS calendar sync
- Touch-friendly kiosk UI for large displays
- Admin panel for events, branding, and settings
- Fullscreen Electron shell with registration domain whitelist

## Raspberry Pi (recommended)

Build a release package on your dev machine, then install on a fresh Pi OS Lite 64-bit image with SSH enabled.

### 1. Build the package

```bash
npm install
npm run package:pi
```

Output: `dist/event-kiosk-pi-0.0.1.tar.gz`

### 2. Install on the Pi

```bash
scp dist/event-kiosk-pi-*.tar.gz pi@<pi-ip>:~/
ssh pi@<pi-ip>
tar -xzf event-kiosk-pi-*.tar.gz && cd event-kiosk-pi-*
sudo bash install.sh --web-only    # backend only — good first test
# or
sudo bash install.sh               # full kiosk with touchscreen
```

Set your admin password:

```bash
sudo nano /opt/kiosk/web/.env
sudo systemctl restart kiosk-web
```

Admin: `http://<pi-ip>:3000/admin`

Portrait monitors: `sudo bash install.sh --rotation left`

### Updates

Build a new package, copy it to the Pi, extract, and run `sudo bash update.sh` (not `install.sh`).

If something goes wrong, SSH still works — run `sudo bash /opt/kiosk/uninstall.sh` or press **Ctrl+Alt+F2**.

More Pi details: [deploy/pi-os-lite/README.md](deploy/pi-os-lite/README.md)

## Development

Requires Node.js 20.9+.

```bash
npm install
cp apps/web/.env.example apps/web/.env
npm run db:push --workspace=web
npm run db:seed --workspace=web
npm run dev
```

Optional Electron shell: `npm run dev:shell`

| URL | Purpose |
|-----|---------|
| http://localhost:3000/kiosk | Kiosk UI |
| http://localhost:3000/admin | Admin panel (default password: `changeme`) |

### Environment variables

Copy `apps/web/.env.example` to `apps/web/.env`. Required: `ADMIN_PASSWORD`, `SESSION_SECRET`. Set `COOKIE_SECURE=false` when using HTTP on a Pi.

Breeze credentials can go in `.env` or Admin → Settings.

## Other Linux systems

For Ubuntu, Pi OS Desktop, or any system with X11:

1. Copy the project to `/opt/kiosk`
2. Install Node.js 20+, run `npm install`, build the web and shell apps
3. Configure `/opt/kiosk/apps/web/.env`
4. Run `sudo bash deploy/linux/lockdown.sh`
5. Start services: `sudo systemctl start kiosk-web kiosk-shell`

This path uses X11 (`kiosk-shell.service`). Pi OS Lite uses Wayland/cage instead — use the Pi package installer above.

## Breeze setup

1. In Breeze: **Account → API** — copy subdomain and API key
2. In admin **Settings**, enter credentials and select calendars
3. **Sync Now**, then edit events and publish

Breeze-owned fields (title, date) update on sync. Admin-added content is preserved.

## Project structure

```
apps/web/           Next.js kiosk UI, admin, API, Breeze sync
apps/shell/         Electron kiosk shell
deploy/pi-os-lite/  Pi release packaging and installer scripts
deploy/linux/       Generic Linux systemd setup
scripts/            Build scripts
```

## License

Private — for organization use.
