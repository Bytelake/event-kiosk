**This project generated with the use of Cursor. Use at your own risk**

# Event Kiosk

Free, self-hosted touchscreen software for listing events. Visitors browse on a display and sign up through any registration site you allow. Admins add images, descriptions, and links; optional sync from **Breeze CHMS**.

Runs on **Debian/Ubuntu** (including Raspberry Pi OS) and **Fedora Atomic** (Desktop and IoT). Also runs locally for development on macOS, Linux, or Windows.

<p align="center">
  <img src="media/kiosk-home-20260608-204733.png" alt="Kiosk home screen listing upcoming events" width="320" />
  <img src="media/kiosk-events-cmq61ci2t000132pxqp32g0hm-20260608-204729.png" alt="Kiosk event detail screen" width="320" />
</p>

## Features

- Breeze CHMS calendar sync
- Touch-friendly kiosk UI for large displays
- Admin panel for events, branding, and settings
- Fullscreen Electron shell with registration domain whitelist

## Supported platforms

| Platform | Install path | Architectures |
|----------|--------------|---------------|
| Debian, Ubuntu, Raspberry Pi OS | [deploy/debian/](deploy/debian/) | arm64, amd64 |
| Fedora Atomic Desktop / IoT | [deploy/fedora-atomic/](deploy/fedora-atomic/) | x86_64 (arm64 where packages exist) |

## Debian / Ubuntu (includes Raspberry Pi)

Install from a **pre-built release package** or from source. See [deploy/debian/README.md](deploy/debian/README.md).

### 1. Get the release package

Download the latest tarball from [GitHub Releases](https://github.com/Bytelake/event-kiosk/releases):

- `event-kiosk-debian-amd64-*.tar.gz` — x86_64 PCs, Ubuntu Server, etc.
- `event-kiosk-debian-arm64-*.tar.gz` — Raspberry Pi 4/5, ARM SBCs
- `event-kiosk-pi-*.tar.gz` — alias for the arm64 package (legacy name)

### 2. Install

```bash
tar -xzf event-kiosk-debian-*.tar.gz && cd event-kiosk-debian-*
sudo bash install.sh
```

Set your admin password:

```bash
sudo nano /var/lib/kiosk/.env
sudo systemctl restart kiosk-web
```

Admin webpage: `http://<ip-of-kiosk>:3000/admin`

For portrait monitors: `sudo bash install.sh --rotation left`

For Ubuntu Desktop with an existing X session: `sudo bash install.sh --display=x11`

### Install from source

```bash
git clone https://github.com/Bytelake/event-kiosk.git ~/event-kiosk
cd ~/event-kiosk
sudo bash deploy/debian/install.sh
```

### Updates

Download a newer release package, extract, and run `sudo bash update.sh` (not `install.sh`). Application code lives in `/opt/kiosk`; your database, uploads, and config live in `/var/lib/kiosk`.

To uninstall: `sudo bash /opt/kiosk/uninstall.sh` or press **Ctrl+Alt+F2**.

## Fedora Atomic

For Fedora Atomic Desktop (Silverblue, Kinoite) or Fedora Atomic IoT. See [deploy/fedora-atomic/README.md](deploy/fedora-atomic/README.md).

```bash
git clone https://github.com/Bytelake/event-kiosk.git ~/event-kiosk
cd ~/event-kiosk
sudo bash deploy/fedora-atomic/install.sh
```

The web backend runs in a **Podman container**; the Electron display runs on the host. If new OS packages are layered, reboot and re-run the installer.

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

### Desktop dev mode

For local development with a normal mouse, keyboard, visible cursor, and a portrait 9:16 Electron window (matching vertical kiosk orientation):

```bash
npm run dev:desktop
```

This starts the Next.js dev server and Electron shell together. Admin is still available in your browser at http://localhost:3000/admin.

Alternatively, set `KIOSK_DESKTOP_MODE=true` in `apps/web/.env` for web-only desktop behavior (visible cursor, no idle redirect) when using `npm run dev` without the shell.

Desktop mode disables hidden cursor styling and the 60-second idle redirect on event detail pages. Production kiosk behavior is unchanged when the flag is unset or `false`.

#### Screenshots for docs

While `dev:desktop` is running, navigate to the kiosk screen you want, then press **Cmd+Shift+S** (Mac) or **Ctrl+Shift+S** (Linux/Windows). This saves an exact **1080×1920** PNG to `screenshots/` at the repo root (e.g. `kiosk-home-20250608-143022.png`). The shortcut is ignored while a registration overlay is open.

| URL | Purpose |
|-----|---------|
| http://localhost:3000/kiosk | Preview Kiosk UI |
| http://localhost:3000/admin | Admin panel (default password: `changeme`) |

### Environment variables

Copy `apps/web/.env.example` to `apps/web/.env`. Required: `ADMIN_PASSWORD`, `SESSION_SECRET`. Set `COOKIE_SECURE=false` when using HTTP on a kiosk. Set `KIOSK_DESKTOP_MODE=true` for local desktop dev (see above).

Breeze credentials can go in `.env` or Admin → Settings.

### Release packages

Build a Debian/Ubuntu tarball on a dev machine:

```bash
npm run package:debian          # host arch
npm run package:debian amd64    # explicit arch label
npm run package:debian arm64
```

## Breeze setup

1. In Breeze: **Account → API** — copy subdomain and API key
2. In admin **Settings**, enter credentials and select calendars
3. **Sync Now**, then edit events and publish

Breeze-owned fields (title, date) update on sync. Admin-added content is preserved.

## Contributing

Changes go through pull requests — see [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow (branching, CI, merging, and releases).

## Project structure

```
apps/web/              Next.js kiosk UI, admin, API, Breeze sync
apps/shell/            Electron kiosk shell
deploy/common/         Shared install scripts, systemd units, paths
deploy/debian/         Debian/Ubuntu installer and release package
deploy/fedora-atomic/  Fedora Atomic installer (Quadlet + rpm-ostree)
deploy/containers/     Containerfile for Atomic web backend
deploy/pi-os-lite/     Deprecated wrappers (use deploy/debian/)
scripts/               Build scripts
```

## License

[MIT](LICENSE) — free to use, modify, and distribute.
