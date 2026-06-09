Event Kiosk — Debian/Ubuntu Release Package
============================================

Pre-built web server and Electron shell. No npm build on the target machine.

Supported: Debian 12+, Ubuntu 22.04+, Raspberry Pi OS (Lite or Desktop), arm64 and amd64.

INSTALL
  1. Extract the tarball on the target system
  2. sudo bash install.sh
  3. sudo nano /var/lib/kiosk/.env
  4. sudo systemctl restart kiosk-web

  Admin: http://<host-ip>:3000/admin

OPTIONS
  --web-only              Backend only
  --display=wayland       Headless cage (default)
  --display=x11           Electron on X11 session
  --rotation left         Portrait monitor

UPDATE
  Extract a newer tarball, then: sudo bash update.sh
  Data lives in /var/lib/kiosk and is not touched by updates.

RECOVERY
  Uninstall: sudo bash /opt/kiosk/uninstall.sh
  Console: Ctrl+Alt+F2
