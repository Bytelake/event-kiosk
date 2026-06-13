# Alpine Linux

Install Event Kiosk on **Alpine Linux 3.20+** on **arm64** or **amd64**. Supports **systemd** or **OpenRC** (auto-detected at install time).

## Prerequisites

- Enable **community** and **testing** repositories (install scripts do this automatically).
- Display mode requires the Alpine **`electron`** package from the testing repo (musl build).
- Node.js 20+ (`nodejs` apk or pre-installed).

## Release package (recommended)

Download `event-kiosk-alpine-<arch>-*.tar.gz` from [GitHub Releases](https://github.com/Bytelake/event-kiosk/releases).

```bash
tar -xzf event-kiosk-alpine-amd64-*.tar.gz && cd event-kiosk-alpine-*
sudo bash install.sh
sudo nano /var/lib/kiosk/.env
sudo systemctl restart kiosk-web    # OpenRC: sudo rc-service kiosk-web restart
```

### Options

| Flag | Description |
|------|-------------|
| `--web-only` | Backend only, no fullscreen display |
| `--display=wayland` | Headless cage on tty1 (default) |
| `--display=x11` | Electron on X11 (`DISPLAY=:0`) |
| `--rotation left` | Portrait monitor (`right`, `inverted`, `normal`) |

## Install from source

```bash
git clone https://github.com/Bytelake/event-kiosk.git ~/event-kiosk
cd ~/event-kiosk
sudo bash deploy/alpine/install.sh
```

## Layout

| Path | Purpose |
|------|---------|
| `/opt/kiosk/web/` | Next.js standalone server |
| `/opt/kiosk/shell/` | Electron shell |
| `/var/lib/kiosk/` | Database, uploads, `.env`, `display.env` |

## Updates

Extract a newer release tarball and run `sudo bash update.sh` (not `install.sh`).

## Uninstall

```bash
sudo bash /opt/kiosk/uninstall.sh
```

Recovery: **Ctrl+Alt+F2** for a normal console login.

## Electron on musl

Alpine uses musl libc. The install flow uses the system **`electron`** apk (not npm’s glibc prebuilt) with `ELECTRON_SKIP_BINARY_DOWNLOAD=1` for shell dependencies.
