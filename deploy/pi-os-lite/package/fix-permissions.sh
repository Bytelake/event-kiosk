#!/usr/bin/env bash
# Fix ownership after a partial install (run as root).
set -euo pipefail
chown -R kiosk:kiosk /opt/kiosk
echo "Fixed ownership of /opt/kiosk → kiosk:kiosk"
echo "Now run: sudo bash /opt/kiosk/setup-db.sh"
