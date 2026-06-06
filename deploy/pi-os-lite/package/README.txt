Event Kiosk — Raspberry Pi Release Package
==========================================

Pre-built web server and Electron shell. No npm build on the Pi.

INSTALL
  1. Flash Pi OS Lite 64-bit, enable SSH
  2. scp event-kiosk-pi-*.tar.gz pi@<pi-ip>:~/
  3. tar -xzf event-kiosk-pi-*.tar.gz && cd event-kiosk-pi-*
  4. sudo bash install.sh
  5. sudo nano /opt/kiosk/web/.env
  6. sudo systemctl restart kiosk-web

  Admin: http://<pi-ip>:3000/admin

OPTIONS
  --web-only           Backend only (safest first test)
  --rotation left      Portrait monitor (also: right, inverted, normal)

UPDATE
  Build new package on dev machine (npm run package:pi), copy to Pi, then:
  sudo bash update.sh

  Do not re-run install.sh on an existing kiosk.

RECOVERY
  SSH: ssh pi@<pi-ip>
  Uninstall: sudo bash /opt/kiosk/uninstall.sh
  Console: Ctrl+Alt+F2

UNINSTALL
  sudo bash /opt/kiosk/uninstall.sh
