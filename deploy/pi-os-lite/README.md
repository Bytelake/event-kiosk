# Raspberry Pi OS Lite

Headless kiosk using **systemd**, **cage** (Wayland), and **Electron**. No desktop environment required.

For the standard install path, see the main [README](../../README.md#raspberry-pi-recommended).

## Hardware

- Raspberry Pi 4 or 5 (4 GB+ RAM recommended)
- USB touchscreen (24–32")
- 32 GB+ microSD, Ethernet or Wi‑Fi

## Install from source (alternative)

If you cannot build the release package on another machine, clone this repo on the Pi and run the source installer. This compiles on the Pi and takes 5–15 minutes.

```bash
git clone <repo-url> ~/kiosk-project
cd ~/kiosk-project
sudo bash deploy/pi-os-lite/install.sh
sudo nano /opt/kiosk/apps/web/.env
sudo systemctl start kiosk-web
sudo reboot
```

## How it works

```
Boot
 ├── kiosk-web.service    Next.js on :3000
 └── kiosk-display.service → cage on tty1 → Electron
```

## Maintenance

| Task | Command |
|------|---------|
| Status | `sudo systemctl status kiosk-web kiosk-display` |
| Logs | `sudo journalctl -u kiosk-web -f` |
| Restart | `sudo systemctl restart kiosk-web kiosk-display` |
| Diagnose | `sudo bash /opt/kiosk/diagnose.sh` |

Pre-built package installs place scripts under `/opt/kiosk/`. Source installs use `/opt/kiosk/deploy/pi-os-lite/`.

## Portrait monitors

```bash
sudo nano /opt/kiosk/display.env          # KIOSK_DISPLAY_ROTATION=left
sudo /opt/kiosk/bin/set-display-rotation.sh --set left
sudo systemctl restart kiosk-display
```

Rotation values: `normal`, `left`, `right`, `inverted`. Applied via `wlr-randr` — not `config.txt`.

## Troubleshooting

**Admin login loops:** Set `COOKIE_SECURE=false` in `.env`, restart `kiosk-web`.

**Black screen / console instead of kiosk:**

```bash
sudo systemctl status kiosk-display
sudo journalctl -u kiosk-display -n 50
sudo bash /opt/kiosk/diagnose.sh
```

**Database / Prisma errors on source install:**

```bash
sudo bash /opt/kiosk/setup-db.sh
sudo systemctl restart kiosk-web
```

**Admin unreachable:** Confirm port 3000 is open — `curl http://<pi-ip>:3000/admin/login`
