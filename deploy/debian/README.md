# Debian / Ubuntu

Install Event Kiosk on **Debian 12+**, **Ubuntu 22.04+**, or **Raspberry Pi OS** (Lite or Desktop), on **arm64** or **amd64**.

## Release package (recommended)

Download `event-kiosk-debian-<arch>-*.tar.gz` from [GitHub Releases](https://github.com/Bytelake/event-kiosk/releases).

```bash
tar -xzf event-kiosk-debian-amd64-*.tar.gz && cd event-kiosk-debian-*
sudo bash install.sh
sudo nano /var/lib/kiosk/.env
sudo systemctl restart kiosk-web
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
sudo bash deploy/debian/install.sh
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
