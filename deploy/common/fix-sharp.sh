#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${1:-/opt/kiosk}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=kiosk-paths.sh
source "${SCRIPT_DIR}/kiosk-paths.sh"
kiosk_install_sharp "${INSTALL_DIR}"
chown -R kiosk:kiosk "${INSTALL_DIR}"
echo "[fix-sharp] sharp installed. Restart the web service: sudo systemctl restart kiosk-web"
