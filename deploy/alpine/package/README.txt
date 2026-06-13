Event Kiosk — Alpine Linux Release Package
==========================================

Pre-built web server and Electron shell. No npm build on the target machine.

Supported: Alpine Linux 3.20+ (community + testing repos), arm64 and amd64.
Init: systemd or OpenRC (auto-detected).

INSTALL
  1. Extract the tarball on the target system
  2. su -c 'bash install.sh'              (root required; Alpine has no sudo apk)
  3. su -c 'nano /var/lib/kiosk/.env'
  4. su -c 'rc-service kiosk-web restart'
     (systemd: systemctl restart kiosk-web)

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
