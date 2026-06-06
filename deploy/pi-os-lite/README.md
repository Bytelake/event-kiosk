# Raspberry Pi OS Lite — Kiosk Setup

These instructions are for **Pi OS Lite** (no desktop environment). The kiosk uses:

- **systemd** — runs the Next.js web backend headlessly
- **cage** — minimal Wayland compositor (single fullscreen app, no desktop)
- **Electron** — fullscreen touch UI and embedded registration browser

You do **not** need Pi OS Desktop or GNOME/KDE.

## Hardware

- Raspberry Pi **4 or 5** (4 GB+ RAM recommended)
- USB touchscreen display (24–32")
- microSD card (32 GB+)
- Ethernet or Wi‑Fi

## 1. Flash Pi OS Lite

1. Download **[Raspberry Pi OS Lite (64-bit)](https://www.raspberrypi.com/software/operating-systems/)** (Bookworm or newer).
2. Flash with [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
3. In Imager **OS Customization** (gear icon), set:
   - Hostname (e.g. `event-kiosk`)
   - Username/password (for SSH maintenance — the kiosk user is created by the installer)
   - Wi‑Fi credentials (if not using Ethernet)
   - Enable SSH
4. Boot the Pi and SSH in:

```bash
ssh pi@event-kiosk.local
```

## 2. Copy the project to the Pi

From your development machine:

```bash
rsync -av --exclude node_modules --exclude .next --exclude .git \
  "/path/to/Kiosk Project/" pi@event-kiosk.local:~/kiosk-project/
```

Or clone from git if the project is in a repository.

## 3. Run the installer

On the Pi:

```bash
cd ~/kiosk-project
sudo bash deploy/pi-os-lite/install.sh
```

The script will:

- Install **cage**, **seatd**, Node.js 20, and Electron system libraries
- Copy the app to **`/opt/kiosk`**
- Build the web app and Electron shell
- Create the **`kiosk`** system user
- Enable **`kiosk-web.service`** (Next.js on port 3000)
- Configure **tty1 autologin** → **cage** → **Electron**

Build time on a Pi 4 is typically **5–15 minutes**.

## 4. Configure secrets

```bash
sudo nano /opt/kiosk/apps/web/.env
```

Set at minimum:

```env
DATABASE_URL="file:./dev.db"
ADMIN_PASSWORD="your-secure-password"
SESSION_SECRET="long-random-string-here"
BREEZE_SUBDOMAIN="yourchurch"
BREEZE_API_KEY="your-breeze-api-key"
```

## 5. Start and reboot

```bash
sudo systemctl start kiosk-web
sudo reboot
```

After reboot:

- The display shows the kiosk automatically (no login prompt on the touchscreen).
- Open admin from **another computer or phone**: `http://<pi-ip>:3000/admin`

Find the Pi’s IP:

```bash
hostname -I
```

## How it works

```
Boot
 ├── systemd → kiosk-web.service (Next.js on :3000)
 └── tty1 autologin (kiosk user)
      └── cage (Wayland, one app only)
           └── Electron shell → http://localhost:3000/kiosk
```

No desktop environment is installed or required.

## Maintenance commands

| Task | Command |
|------|---------|
| Web app status | `sudo systemctl status kiosk-web` |
| Web app logs | `sudo journalctl -u kiosk-web -f` |
| Restart web app | `sudo systemctl restart kiosk-web` |
| Re-run installer after update | `cd ~/kiosk-project && sudo bash deploy/pi-os-lite/install.sh` |
| Test kiosk URL locally | `curl http://localhost:3000/kiosk` |

## Updating the app

Copy new code to the Pi, then re-run the installer (it rebuilds in `/opt/kiosk`):

```bash
rsync -av --exclude node_modules --exclude .next --exclude .git \
  "/path/to/Kiosk Project/" pi@event-kiosk.local:~/kiosk-project/

ssh pi@event-kiosk.local
cd ~/kiosk-project
sudo bash deploy/pi-os-lite/install.sh
sudo reboot
```

## Troubleshooting

### Black screen after reboot

1. Check the web backend is running:
   ```bash
   sudo systemctl status kiosk-web
   curl http://localhost:3000/kiosk
   ```
2. Check seatd:
   ```bash
   sudo systemctl status seatd
   ```
3. Switch to tty1 (if you have a keyboard attached): **Ctrl+Alt+F1** and look for errors.

### Electron does not start

Run the display script manually as the kiosk user:

```bash
sudo -u kiosk bash /opt/kiosk/deploy/pi-os-lite/start-kiosk-display.sh
```

### Touchscreen not working

Most USB touchscreens work out of the box. Verify input devices:

```bash
ls /dev/input/
```

### Admin panel unreachable

Ensure port 3000 is reachable on your network. From another device:

```bash
curl http://<pi-ip>:3000/admin/login
```

If using a firewall, allow port 3000 for your admin subnet only.

## Differences from generic Linux deploy

| Generic (`deploy/linux/`) | Pi OS Lite (`deploy/pi-os-lite/`) |
|---------------------------|-----------------------------------|
| Assumes X11 `DISPLAY=:0` | Uses **cage** on Wayland |
| `kiosk-shell.service` for Electron | Electron via **tty1 autologin** |
| Manual package setup | **All-in-one `install.sh`** |
