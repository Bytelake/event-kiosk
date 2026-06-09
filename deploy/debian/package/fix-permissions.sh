#!/usr/bin/env bash
set -euo pipefail
chown -R kiosk:kiosk /opt/kiosk /var/lib/kiosk
echo "Fixed ownership of /opt/kiosk and /var/lib/kiosk → kiosk:kiosk"
