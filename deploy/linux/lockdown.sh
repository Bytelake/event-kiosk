#!/usr/bin/env bash
set -euo pipefail

# Run as root on Ubuntu / Raspberry Pi OS after installing the kiosk app to /opt/kiosk

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo ./lockdown.sh"
  exit 1
fi

echo "Creating kiosk user..."
id kiosk &>/dev/null || useradd -m -s /bin/bash kiosk

echo "Disabling screen blanking and suspend..."
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target || true

mkdir -p /etc/X11/xorg.conf.d
cat >/etc/X11/xorg.conf.d/10-blanking.conf <<'EOF'
Section "ServerFlags"
    Option "BlankTime" "0"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime" "0"
EOF

echo "Installing systemd services..."
cp /opt/kiosk/deploy/linux/kiosk-web.service /etc/systemd/system/
cp /opt/kiosk/deploy/linux/kiosk-shell.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable kiosk-web.service kiosk-shell.service

echo "Lockdown complete."
echo "Configure /opt/kiosk/apps/web/.env then run: systemctl start kiosk-web kiosk-shell"
